import type { Player, SortKey } from "../types";

export function reassignOverallRanks(players: Player[]): Player[] {
  return players.map((p, i) => ({ ...p, overallRank: i + 1 }));
}

// Default board order: sort by ADP (nulls last), then rank 1..N and split into
// even tiers of `tierSize`. Used as the starting layout before the user edits.
export function orderByAdp(players: Player[], tierSize = 12): Player[] {
  const sorted = players.slice().sort((a, b) => {
    if (a.adp == null && b.adp == null) return 0;
    if (a.adp == null) return 1;
    if (b.adp == null) return -1;
    return a.adp - b.adp;
  });
  return sorted.map((p, i) => ({
    ...p,
    overallRank: i + 1,
    tier: Math.floor(i / tierSize) + 1,
  }));
}

export function computePositionalRanks(
  players: Player[],
): Record<string, number> {
  const byPos: Record<string, Player[]> = {};
  for (const p of players) (byPos[p.position] ??= []).push(p);
  const result: Record<string, number> = {};
  for (const pos of Object.keys(byPos)) {
    byPos[pos]
      .slice()
      .sort((a, b) => a.overallRank - b.overallRank)
      .forEach((p, i) => {
        result[p.id] = i + 1;
      });
  }
  return result;
}

export interface TierGroup {
  tier: number | null;
  players: Player[];
}

export function groupByTier(players: Player[]): TierGroup[] {
  const sorted = players.slice().sort((a, b) => a.overallRank - b.overallRank);
  const map = new Map<number | null, Player[]>();
  for (const p of sorted) {
    if (!map.has(p.tier)) map.set(p.tier, []);
    map.get(p.tier)!.push(p);
  }
  const numbered = [...map.keys()]
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  const groups: TierGroup[] = numbered.map((t) => ({
    tier: t,
    players: map.get(t)!,
  }));
  if (map.has(null)) groups.push({ tier: null, players: map.get(null)! });
  return groups;
}

function nullableCompare(
  a: number | null,
  b: number | null,
  dir: number,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls always last, regardless of direction
  if (b == null) return -1;
  return (a - b) * dir;
}

// Per-id scored maps for the value-better numeric columns (higher is better,
// nulls sort last). All three derive from the same scoring pipeline.
export type ScoredMaps = Partial<
  Record<"vor" | "proj" | "last", Record<string, number | null>>
>;

export function sortPlayers(
  players: Player[],
  key: SortKey,
  asc = true,
  scored: ScoredMaps = {},
): Player[] {
  const dir = asc ? 1 : -1;
  // Value-better columns share the normal direction (asc => low→high); they
  // just default to descending via defaultSortAsc. Nulls sort last regardless.
  const byScore = (
    map: Record<string, number | null> | undefined,
    a: Player,
    b: Player,
  ) => nullableCompare(map?.[a.id] ?? null, map?.[b.id] ?? null, dir);
  const cmp = (a: Player, b: Player): number => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "adp":
        return nullableCompare(a.adp, b.adp, dir);
      case "bye":
        return nullableCompare(a.byeWeek, b.byeWeek, dir);
      case "pos":
        return (
          a.position.localeCompare(b.position) * dir ||
          a.overallRank - b.overallRank
        );
      case "vor":
        return byScore(scored.vor, a, b);
      case "proj":
        return byScore(scored.proj, a, b);
      case "last":
        return byScore(scored.last, a, b);
      case "overall":
      default:
        return (a.overallRank - b.overallRank) * dir;
    }
  };
  return players.slice().sort(cmp);
}

// --- Tier structure ---------------------------------------------------------
// Tiers are contiguous blocks along the overall-rank ordering. These helpers
// treat the ranked list as a sequence of adjacency blocks (one per tier) so
// tier edits stay simple and always re-emit contiguous 1..N tier numbers.

function toBlocks(players: Player[]): Player[][] {
  const ordered = players.slice().sort((a, b) => a.overallRank - b.overallRank);
  const blocks: Player[][] = [];
  for (const p of ordered) {
    const last = blocks[blocks.length - 1];
    if (last && last[0].tier === p.tier) last.push(p);
    else blocks.push([p]);
  }
  return blocks;
}

function fromBlocks(blocks: Player[][]): Player[] {
  const out: Player[] = [];
  blocks.forEach((blk, i) =>
    blk.forEach((p) => out.push({ ...p, tier: i + 1 })),
  );
  return reassignOverallRanks(out);
}

// Every player gets a numeric tier: a player with no tier adopts the tier of
// the player above it; the topmost untiered player defaults to tier 1. Result
// is renumbered to contiguous 1..N. (No "Untiered" group.)
export function normalizeTiers(players: Player[]): Player[] {
  const ordered = players.slice().sort((a, b) => a.overallRank - b.overallRank);
  let current = 1;
  const filled = ordered.map((p) => {
    if (p.tier != null) {
      current = p.tier;
      return p;
    }
    return { ...p, tier: current };
  });
  return fromBlocks(toBlocks(filled));
}

// Default sort direction for a freshly-clicked header. Value-better numeric
// columns (VOR) start descending; identity/ordinal columns start ascending.
export function defaultSortAsc(key: SortKey): boolean {
  // Value-better numeric columns default to descending (higher first).
  return key !== "vor" && key !== "proj" && key !== "last";
}

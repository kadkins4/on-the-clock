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

export function sortPlayers(
  players: Player[],
  key: SortKey,
  asc = true,
  vorById?: Record<string, number | null>,
): Player[] {
  const dir = asc ? 1 : -1;
  const cmp = (a: Player, b: Player): number => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "adp":
        return nullableCompare(a.adp, b.adp, dir);
      case "bye":
        return nullableCompare(a.byeWeek, b.byeWeek, dir);
      case "vor":
        // higher VOR is better, so invert dir; nulls sort last regardless
        return nullableCompare(
          vorById?.[a.id] ?? null,
          vorById?.[b.id] ?? null,
          -dir,
        );
      case "overall":
      default:
        return (a.overallRank - b.overallRank) * dir;
    }
  };
  return players.slice().sort(cmp);
}

// Reorder by dragging `activeId` onto `overId` in the overall-rank ordering.
// The moved player lands directly ABOVE the drop target and adopts the target's
// tier — so dragging across a divider joins the tier you dropped onto, the same
// way in both directions (no swap with the neighbor below the target).
export function moveAndRetier(
  players: Player[],
  activeId: string,
  overId: string,
): Player[] {
  const ordered = players.slice().sort((a, b) => a.overallRank - b.overallRank);
  const moved = ordered.find((p) => p.id === activeId);
  const over = ordered.find((p) => p.id === overId);
  if (!moved || !over || activeId === overId) return players;
  const without = ordered.filter((p) => p.id !== activeId);
  const overIdx = without.findIndex((p) => p.id === overId);
  without.splice(overIdx, 0, { ...moved, tier: over.tier });
  // Renumber so an emptied tier doesn't leave a gap in the sequence.
  return fromBlocks(toBlocks(reassignOverallRanks(without)));
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

// Move the whole tier `fromTier` to the position currently held by `toTier`.
export function moveTier(
  players: Player[],
  fromTier: number,
  toTier: number,
): Player[] {
  const blocks = toBlocks(players);
  const from = fromTier - 1;
  const to = toTier - 1;
  if (
    from < 0 ||
    from >= blocks.length ||
    to < 0 ||
    to >= blocks.length ||
    from === to
  )
    return players;
  const [blk] = blocks.splice(from, 1);
  blocks.splice(to, 0, blk);
  return fromBlocks(blocks);
}

// Start a new tier at `playerId` (the player and everything below it in its
// current tier become a new tier). No-op if the player already starts a tier.
export function splitTierAt(players: Player[], playerId: string): Player[] {
  const blocks = toBlocks(players);
  for (let i = 0; i < blocks.length; i++) {
    const idx = blocks[i].findIndex((p) => p.id === playerId);
    if (idx === -1) continue;
    if (idx === 0) return players; // already a tier boundary
    blocks.splice(i, 1, blocks[i].slice(0, idx), blocks[i].slice(idx));
    return fromBlocks(blocks);
  }
  return players;
}

// Remove a tier: its players merge up into the tier above (or down into the
// next tier if it is the top tier). Renumbers the rest.
export function removeTier(players: Player[], tier: number): Player[] {
  const blocks = toBlocks(players);
  const i = tier - 1;
  if (i < 0 || i >= blocks.length || blocks.length <= 1) return players;
  if (i === 0) {
    blocks[1] = [...blocks[0], ...blocks[1]];
    blocks.splice(0, 1);
  } else {
    blocks[i - 1] = [...blocks[i - 1], ...blocks[i]];
    blocks.splice(i, 1);
  }
  return fromBlocks(blocks);
}

// Move `playerId` to sit just above `beforeId` (or to the end when null) as its
// own brand-new tier. Used when a player is dropped into an empty tier slot.
export function moveIntoNewTier(
  players: Player[],
  playerId: string,
  beforeId: string | null,
): Player[] {
  const ordered = players.slice().sort((a, b) => a.overallRank - b.overallRank);
  const fromIdx = ordered.findIndex((p) => p.id === playerId);
  if (fromIdx === -1) return players;
  const [moved] = ordered.splice(fromIdx, 1);
  const insertAt =
    beforeId == null
      ? ordered.length
      : (() => {
          const i = ordered.findIndex((p) => p.id === beforeId);
          return i === -1 ? ordered.length : i;
        })();
  ordered.splice(insertAt, 0, moved);
  let result = splitTierAt(reassignOverallRanks(ordered), playerId);
  const idx = result.findIndex((p) => p.id === playerId);
  const after = result[idx + 1];
  if (after) result = splitTierAt(result, after.id);
  return result;
}

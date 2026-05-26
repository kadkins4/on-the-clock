import type { Player, SortKey } from "../types";

export function reassignOverallRanks(players: Player[]): Player[] {
  return players.map((p, i) => ({ ...p, overallRank: i + 1 }));
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
      case "overall":
      default:
        return (a.overallRank - b.overallRank) * dir;
    }
  };
  return players.slice().sort(cmp);
}

// Reorder by dragging `activeId` onto `overId` in the overall-rank ordering.
// The moved player adopts the tier of its new upper neighbor (or lower neighbor
// if it lands first), giving "drag across a divider re-tiers" behavior.
export function moveAndRetier(
  players: Player[],
  activeId: string,
  overId: string,
): Player[] {
  const ordered = players.slice().sort((a, b) => a.overallRank - b.overallRank);
  const from = ordered.findIndex((p) => p.id === activeId);
  const to = ordered.findIndex((p) => p.id === overId);
  if (from === -1 || to === -1 || from === to) return players;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  const idx = ordered.findIndex((p) => p.id === activeId);
  const neighbor = idx > 0 ? ordered[idx - 1] : ordered[idx + 1];
  const newTier = neighbor ? neighbor.tier : moved.tier;
  ordered[idx] = { ...moved, tier: newTier };
  return reassignOverallRanks(ordered);
}

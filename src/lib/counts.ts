import type { Player, Position } from "../types";
import { POSITIONS } from "../types";

export interface PositionCount {
  drafted: number; // taken by anyone (mine + others)
  mine: number; // drafted by me
}

export function draftedByPosition(
  players: Player[],
): Record<Position, PositionCount> {
  const counts = Object.fromEntries(
    POSITIONS.map((p) => [p, { drafted: 0, mine: 0 }]),
  ) as Record<Position, PositionCount>;
  for (const p of players) {
    if (p.draftStatus === "available") continue;
    counts[p.position].drafted++;
    if (p.draftStatus === "mine") counts[p.position].mine++;
  }
  return counts;
}

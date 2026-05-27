import type { Player, Position } from "../types";
import { POSITIONS } from "../types";

export function draftedByPosition(players: Player[]): Record<Position, number> {
  const counts = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<
    Position,
    number
  >;
  for (const p of players) {
    if (p.draftStatus !== "available") counts[p.position]++;
  }
  return counts;
}

import type { Player, Position } from "../../types";
import type { MockState } from "./types";

export interface SummaryPlayer {
  id: string;
  name: string;
  position: Position;
  team: string;
  overallPick: number;
  adp: number | null;
  adpDelta: number | null; // adp - overallPick; >0 reach, <0 value
}

export interface MockSummaryResult {
  players: SummaryPlayer[];
  positionCounts: Partial<Record<Position, number>>;
}

export function mockSummary(
  m: MockState,
  teamIndex: number,
): MockSummaryResult {
  const byId = new Map(m.pool.map((pl) => [pl.id, pl]));
  const players: SummaryPlayer[] = m.picks
    .filter((pk) => pk.teamIndex === teamIndex)
    .map((pk) => {
      const pl = byId.get(pk.playerId) as Player;
      return {
        id: pl.id,
        name: pl.name,
        position: pl.position,
        team: pl.team,
        overallPick: pk.overall,
        adp: pl.adp,
        adpDelta: pl.adp == null ? null : pl.adp - pk.overall,
      };
    });

  const positionCounts: Partial<Record<Position, number>> = {};
  for (const pl of players) {
    positionCounts[pl.position] = (positionCounts[pl.position] ?? 0) + 1;
  }
  return { players, positionCounts };
}

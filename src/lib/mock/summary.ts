import type { Player, Position } from "../../types";
import type { MockState } from "./types";
import { pickSignal } from "../draftValue";

export interface SummaryPlayer {
  id: string;
  name: string;
  position: Position;
  team: string;
  overallPick: number;
  adp: number | null;
  adpDelta: number | null; // adp - overallPick; >0 reach, <0 value
  // "reach"/"value" only when the pick is at least a full round (teams picks)
  // off ADP; null when within a round — too close to be worth flagging.
  adpFlag: "reach" | "value" | null;
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
      const threshold = m.settings.valueThreshold ?? m.settings.teams + 2;
      const sig = pickSignal(pl.adp, pk.overall, threshold);
      return {
        id: pl.id,
        name: pl.name,
        position: pl.position,
        team: pl.team,
        overallPick: pk.overall,
        adp: pl.adp,
        adpDelta: pl.adp == null ? null : pl.adp - pk.overall,
        adpFlag: sig?.kind ?? null,
      };
    });

  const positionCounts: Partial<Record<Position, number>> = {};
  for (const pl of players) {
    positionCounts[pl.position] = (positionCounts[pl.position] ?? 0) + 1;
  }
  return { players, positionCounts };
}

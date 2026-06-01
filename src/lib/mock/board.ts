import type { MockState } from "./types";
import type { Player, Position } from "../../types";

export type CellKind = "done" | "current" | "upcoming";

export interface PickCell {
  overall: number; // 1-based overall pick
  round: number; // 1-based
  teamIndex: number; // 0-based team/column
  label: string; // e.g. "1.04"
  teamLabel: string; // e.g. "Team 7"
  kind: CellKind;
  playerId?: string;
  name?: string;
  position?: Position;
}

export function formatPick(overall: number, teams: number): string {
  const round = Math.floor((overall - 1) / teams) + 1;
  const slot = ((overall - 1) % teams) + 1;
  return `${round}.${String(slot).padStart(2, "0")}`;
}

function poolMap(pool: Player[]): Map<string, Player> {
  const m = new Map<string, Player>();
  for (const pl of pool) m.set(pl.id, pl);
  return m;
}

export function buildPickCells(state: MockState): PickCell[] {
  const { order, picks, settings } = state;
  const teams = settings.teams;
  const byId = poolMap(state.pool);
  const made = picks.length;
  return order.map((teamIndex, i) => {
    const overall = i + 1;
    const round = Math.floor((overall - 1) / teams) + 1;
    const base = {
      overall,
      round,
      teamIndex,
      label: formatPick(overall, teams),
      teamLabel: `Team ${teamIndex + 1}`,
    };
    if (overall <= made) {
      const pick = picks[overall - 1];
      const pl = byId.get(pick.playerId);
      return {
        ...base,
        kind: "done" as const,
        playerId: pick.playerId,
        name: pl?.name,
        position: pl?.position,
      };
    }
    return {
      ...base,
      kind: overall === made + 1 ? ("current" as const) : ("upcoming" as const),
    };
  });
}

export function userColumnIndex(state: MockState): number {
  return state.settings.userSlot - 1;
}

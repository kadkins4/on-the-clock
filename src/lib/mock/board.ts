import type { MockState } from "./types";
import type { Player, Position } from "../../types";
import {
  pickSignal,
  defaultValueThreshold,
  type PickSignal,
} from "../draftValue";

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
  signal?: PickSignal; // reach/value vs ADP for a made pick
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
      const threshold = settings.valueThreshold ?? defaultValueThreshold(teams);
      const enabled = settings.valueFlagsEnabled ?? true;
      const signal = enabled
        ? (pickSignal(pl?.adp ?? null, overall, threshold) ?? undefined)
        : undefined;
      return {
        ...base,
        kind: "done" as const,
        playerId: pick.playerId,
        name: pl?.name,
        position: pl?.position,
        signal,
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

export interface PickMarker {
  availIndex: number; // 0-based index into the in-order available list
  overall: number; // 1-based overall pick this marker represents
  round: number; // 1-based round for the user
}

// Where the user's upcoming picks land if every remaining player is drafted
// straight down the available (ADP/board-ordered) list. availIndex is the
// offset into available(state): the player at that index is the one the user
// would get at that pick. Markers are returned in pick order.
export function userPickMarkers(
  state: MockState,
  userTeamIndex: number,
): PickMarker[] {
  const { order, picks, settings } = state;
  const teams = settings.teams;
  const nextOverall = picks.length + 1; // pick currently on the clock
  const markers: PickMarker[] = [];
  for (let overall = nextOverall; overall <= order.length; overall++) {
    if (order[overall - 1] !== userTeamIndex) continue;
    markers.push({
      availIndex: overall - nextOverall,
      overall,
      round: Math.floor((overall - 1) / teams) + 1,
    });
  }
  return markers;
}

// How many picks until the user is next on the clock: 0 when the user holds the
// current pick, -1 when they have no remaining picks. Drives the "N picks away"
// status while the user waits.
export function picksUntilUser(
  state: MockState,
  userTeamIndex: number,
): number {
  const nextOverall = state.picks.length + 1; // pick currently on the clock
  for (let overall = nextOverall; overall <= state.order.length; overall++) {
    if (state.order[overall - 1] === userTeamIndex)
      return overall - nextOverall;
  }
  return -1;
}

export function buildBoardGrid(state: MockState): (PickCell | null)[][] {
  const { rounds, teams } = state.settings;
  const grid: (PickCell | null)[][] = Array.from({ length: rounds }, () =>
    Array.from({ length: teams }, () => null as PickCell | null),
  );
  for (const cell of buildPickCells(state)) {
    if (cell.kind === "done") {
      grid[cell.round - 1][cell.teamIndex] = cell;
    }
  }
  return grid;
}

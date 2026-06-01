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

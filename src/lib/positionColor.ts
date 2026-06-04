import type { Position } from "./types";

// Canonical fantasy position palette (dark theme). Single source of truth;
// CSS mirrors these as --pos-* custom properties.
export const POSITION_COLOR: Record<Position, string> = {
  QB: "#c084fc", // purple
  RB: "#34d399", // green
  WR: "#38bdf8", // blue
  TE: "#fb923c", // orange
  K: "#9aa3b2", // grey
  DST: "#9aa3b2", // grey
};

export function positionColor(pos: Position): string {
  return POSITION_COLOR[pos];
}

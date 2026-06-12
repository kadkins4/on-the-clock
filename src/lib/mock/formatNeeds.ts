import type { Needs } from "./roster";
import type { Position } from "../../types";

const BASE_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

/**
 * Formats a Needs object into a compact string like "QB1 · RB2 · WR1 · TE0".
 * Always includes all base positions; appends FLEX/SUPERFLEX when > 0.
 */
export function formatNeeds(needs: Needs): string {
  const parts: string[] = BASE_POSITIONS.map(
    (pos) => `${pos}${needs.base[pos] ?? 0}`,
  );
  if (needs.flex > 0) parts.push(`FLEX${needs.flex}`);
  if (needs.superflex > 0) parts.push(`SFX${needs.superflex}`);
  return parts.join(" · ");
}

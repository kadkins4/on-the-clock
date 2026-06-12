/**
 * Derives the draft direction for a given round purely from the real order
 * array (decision 9: no recomputed snake math in the view layer).
 *
 * Strategy: look at the first two picks of the round and compare team indices.
 * - first < second → "ltr"  (team numbers increase across the row)
 * - first > second → "rtl"  (team numbers decrease across the row)
 * - single-team leagues (or edge cases) → "ltr" by convention
 */
export function roundDirection(
  order: number[],
  teams: number,
  round: number,
): "ltr" | "rtl" {
  if (teams <= 1) return "ltr";
  const startIdx = (round - 1) * teams; // 0-based index of first pick in this round
  const first = order[startIdx];
  const second = order[startIdx + 1];
  if (first === undefined || second === undefined) return "ltr";
  return first < second ? "ltr" : "rtl";
}

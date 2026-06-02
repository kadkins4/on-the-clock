// Reach/value rule, deliberately free of any mock/draft types so a mock OR a
// synced ESPN live draft can feed it the same way.
export interface PickSignal {
  kind: "reach" | "value";
  amount: number; // picks off the baseline, >= 0
}

// Default flag threshold when a list has no explicit override: a bit over two
// rounds (2 × teams + 2). Centralized so every surface agrees.
export function defaultValueThreshold(teams: number): number {
  return 2 * teams + 2;
}

// A *made* pick vs one baseline (ADP for v1). reach = earlier than baseline,
// value = later. null when no baseline or within the threshold.
export function pickSignal(
  baseline: number | null,
  overallPick: number,
  threshold: number,
): PickSignal | null {
  if (baseline == null) return null;
  const delta = baseline - overallPick;
  if (Math.abs(delta) < threshold) return null;
  return {
    kind: delta > 0 ? "reach" : "value",
    amount: Math.round(Math.abs(delta)),
  };
}

// How far an *undrafted* player has fallen past a baseline (ADP or the user's
// rank), relative to the current pick. Returns the fall when >= threshold, else
// null. Value-only — an available player can't be a reach.
export function fallenBy(
  baseline: number | null,
  currentPick: number,
  threshold: number,
): number | null {
  if (baseline == null) return null;
  const fall = currentPick - baseline;
  if (fall < threshold) return null;
  return Math.round(fall);
}

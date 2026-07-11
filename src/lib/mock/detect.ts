import type { Position } from "../../types";
import type { StrategyId } from "./strategy";

export interface DetectedStrategy {
  // Which strategy the user is trending toward, or null when there isn't
  // enough signal yet. Limited to the RB-timing axis + balanced for v1 — the
  // clearest early tell and the strategies we actually model.
  strategy: StrategyId | null;
  // Confidence ramp: three picks is a tentative "we're detecting this…"; four
  // picks is a confident "you're running this" that the suggester acts on.
  confidence: "low" | "high";
}

// Minimum picks before we say anything at all.
const MIN_PICKS = 3;
// At/after this many picks the read is confident enough to bias suggestions.
const CONFIDENT_PICKS = 4;

// Infer the user's draft strategy from the positions they've taken so far, in
// pick order. Pure — the UI owns any pin/override on top of this.
export function detectStrategy(positions: Position[]): DetectedStrategy {
  if (positions.length < MIN_PICKS) {
    return { strategy: null, confidence: "low" };
  }

  const confidence = positions.length >= CONFIDENT_PICKS ? "high" : "low";
  const rbCount = positions.filter((pos) => pos === "RB").length;
  const anchoredRB = positions[0] === "RB";

  let strategy: StrategyId;
  if (rbCount === 0) {
    strategy = "zeroRB";
  } else if (rbCount >= 2) {
    strategy = "robustRB";
  } else if (rbCount === 1 && anchoredRB) {
    strategy = "heroRB";
  } else {
    strategy = "balanced";
  }

  return { strategy, confidence };
}

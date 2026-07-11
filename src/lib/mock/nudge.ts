import { STRATEGIES, type StrategyId } from "./strategy";
import type { DetectedStrategy } from "./detect";

export interface NudgeCopy {
  icon: string;
  name: string; // plain strategy name, e.g. "Zero RB"
  headline: string; // tone-matched to confidence
  hint: string; // what to target next
  tentative: boolean; // true at low confidence (soft copy, no strong bias)
}

// What to steer toward once a strategy is detected — the "suggest players"
// half. Keyed to the strategies the detector can actually surface.
const HINTS: Partial<Record<StrategyId, string>> = {
  zeroRB: "Load up on WRs — the RB value hits in the middle rounds.",
  heroRB: "Your anchor RB is set — build WR depth now.",
  robustRB: "Backfield's locked early — pivot to WR.",
  balanced: "Balanced build — just take the best player available.",
};

// Turn a detected strategy into user-facing nudge copy, or null when there
// isn't a read yet. Low confidence = a tentative "looks like…"; high = a
// committed "you're running…".
export function nudgeCopy(detected: DetectedStrategy): NudgeCopy | null {
  if (detected.strategy == null) return null;
  const s = STRATEGIES[detected.strategy];
  const tentative = detected.confidence === "low";
  return {
    icon: s.icon,
    name: s.name,
    headline: tentative ? "Looks like" : "You're running",
    hint: HINTS[detected.strategy] ?? "",
    tentative,
  };
}

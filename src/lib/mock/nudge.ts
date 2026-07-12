import { STRATEGIES, type StrategyId } from "./strategy";
import type { DetectedStrategy } from "./detect";

export interface NudgeCopy {
  id: StrategyId; // which glyph to draw
  icon: string;
  name: string; // plain strategy name, e.g. "Zero RB"
  headline: string;
  hint: string; // what to target next
}

// What to steer toward once a strategy is detected — the "suggest players"
// half. Keyed to the strategies the detector can actually surface.
const HINTS: Partial<Record<StrategyId, string>> = {
  zeroRB: "Load up on WRs — the RB value hits in the middle rounds.",
  heroRB: "Your anchor RB is set — build WR depth now.",
  robustRB: "Backfield's locked early — pivot to WR.",
  balanced: "Balanced build — just take the best player available.",
};

// Whether to surface the nudge: only once the read is confident (the tentative
// 3-pick read is intentionally silent) and not dismissed for this strategy.
// Keeping this pure is what lets the confidence gate be tested without rendering
// the whole draft.
export function shouldShowNudge(
  detected: DetectedStrategy,
  dismissedStrategy: StrategyId | null,
): boolean {
  return (
    detected.strategy != null &&
    detected.confidence === "high" &&
    detected.strategy !== dismissedStrategy
  );
}

// Turn a detected strategy into user-facing nudge copy, or null when there's no
// read. The nudge is only shown once the detector is confident (see
// shouldShowNudge), so the copy is always committed — "You're running…".
export function nudgeCopy(strategy: StrategyId | null): NudgeCopy | null {
  if (strategy == null) return null;
  const s = STRATEGIES[strategy];
  return {
    id: strategy,
    icon: s.icon,
    name: s.name,
    headline: "You're running",
    hint: HINTS[strategy] ?? "",
  };
}

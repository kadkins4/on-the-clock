import type { TeamIdentity } from "./teamIdentity";
import { STRATEGIES, type StrategyId } from "./strategy";

export interface RevealRow {
  id: StrategyId; // which glyph to draw
  name: string;
  icon: string;
  label: string;
  blurb: string;
}

// Post-draft reveal: what strategy each bot ran. Skips the user's team and any
// bot with no personality (personalities toggled off).
export function botStrategyReveal(teams: TeamIdentity[]): RevealRow[] {
  const rows: RevealRow[] = [];
  for (const t of teams) {
    if (t.isUser || t.strategy == null) continue;
    const s = STRATEGIES[t.strategy];
    rows.push({
      id: t.strategy,
      name: t.name,
      icon: s.icon,
      label: s.label,
      blurb: s.blurb,
    });
  }
  return rows;
}

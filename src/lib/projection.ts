import type { Player, Position, Scoring, ProjStats } from "../types";

export const OFFENSE: Position[] = ["QB", "RB", "WR", "TE"];

// Standard fantasy point values applied to a raw stat line:
// 1pt / 25 passing yds, 4 / passing TD, -2 / interception, 1pt / 10 rush+rec
// yds, 6 / rush+rec TD, 2 / two-point conversion, -2 / fumble lost. The
// per-reception value comes from the league's scoring (PPR/half/standard) plus
// a TE-premium bump. These match ESPN's projected stat IDs validated against
// their precomputed PPR totals (skill players within ~1%).
//
// Pure scorer for ONE stat line — shared by the season projection (projStats)
// and the last-season actual (lastStats) so both re-score in lockstep when the
// league's scoring or TE-premium changes.
export function scoreStatLine(
  stats: ProjStats,
  position: Position,
  scoring: Scoring,
  tePremium = false,
): number {
  const perRec =
    (scoring === "ppr" ? 1 : scoring === "half" ? 0.5 : 0) +
    (tePremium && position === "TE" ? 0.5 : 0);

  return (
    stats.passYds * 0.04 +
    stats.passTD * 4 -
    stats.int * 2 +
    stats.rushYds * 0.1 +
    stats.rushTD * 6 +
    stats.recYds * 0.1 +
    stats.recTD * 6 +
    stats.rec * perRec +
    stats.twoPt * 2 -
    stats.fumblesLost * 2
  );
}

export function projectedPoints(
  player: Pick<Player, "position" | "projStats" | "projPoints">,
  scoring: Scoring,
  tePremium = false,
): number | null {
  const s = player.projStats;
  // No raw line (K/DST, or not yet provided): fall back to ESPN's own total.
  if (!s) return player.projPoints ?? null;
  return scoreStatLine(s, player.position, scoring, tePremium);
}

// Last-season actual points; null when there's no actual line (no fallback —
// rookies / unmatched / DNP render empty rather than borrowing a projection).
export function lastSeasonPoints(
  player: Pick<Player, "position" | "lastStats">,
  scoring: Scoring,
  tePremium = false,
): number | null {
  const s = player.lastStats;
  if (!s) return null;
  return scoreStatLine(s, player.position, scoring, tePremium);
}

import type { Player, Position, Scoring } from "../types";

export const OFFENSE: Position[] = ["QB", "RB", "WR", "TE"];

// Standard fantasy point values applied to a projected stat line:
// 1pt / 25 passing yds, 4 / passing TD, -2 / interception, 1pt / 10 rush+rec
// yds, 6 / rush+rec TD, 2 / two-point conversion, -2 / fumble lost. The
// per-reception value comes from the league's scoring (PPR/half/standard) plus
// a TE-premium bump. These match ESPN's projected stat IDs validated against
// their precomputed PPR totals (skill players within ~1%).
export function projectedPoints(
  player: Pick<Player, "position" | "projStats" | "projPoints">,
  scoring: Scoring,
  tePremium = false,
): number | null {
  const s = player.projStats;
  // No raw line (K/DST, or not yet provided): fall back to ESPN's own total.
  if (!s) return player.projPoints ?? null;

  const perRec =
    (scoring === "ppr" ? 1 : scoring === "half" ? 0.5 : 0) +
    (tePremium && player.position === "TE" ? 0.5 : 0);

  return (
    s.passYds * 0.04 +
    s.passTD * 4 -
    s.int * 2 +
    s.rushYds * 0.1 +
    s.rushTD * 6 +
    s.recYds * 0.1 +
    s.recTD * 6 +
    s.rec * perRec +
    s.twoPt * 2 -
    s.fumblesLost * 2
  );
}

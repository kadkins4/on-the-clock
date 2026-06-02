import type { Player, Position, RosterSettings, Scoring } from "../types";
import { projectedPoints } from "./projection";

const FLEX_POOL: Position[] = ["RB", "WR", "TE"];
const SUPER_POOL: Position[] = ["QB", "RB", "WR", "TE"];
const SCORERS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

// League-wide count of "starter" slots a position fills before a drafter is
// reaching for replacement-level talent: base starters across all teams plus a
// share of FLEX (RB/WR/TE) and SUPERFLEX (QB/RB/WR/TE) weighted by base count.
export function replacementSlots(
  roster: RosterSettings,
  teams: number,
): Record<Position, number> {
  const base: Record<string, number> = {};
  for (const pos of SCORERS) {
    base[pos] = roster.disabled.includes(pos) ? 0 : roster[pos];
  }
  const slots: Record<string, number> = {};
  for (const pos of SCORERS) slots[pos] = teams * base[pos];

  distribute(slots, base, FLEX_POOL, teams * roster.FLEX);
  distribute(slots, base, SUPER_POOL, teams * roster.SUPERFLEX);

  return slots as Record<Position, number>;
}

function distribute(
  slots: Record<string, number>,
  base: Record<string, number>,
  pool: Position[],
  total: number,
): void {
  if (total <= 0) return;
  const sum = pool.reduce((a, p) => a + base[p], 0);
  if (sum <= 0) return;
  for (const p of pool) slots[p] += Math.round((total * base[p]) / sum);
}

// VOR per player id = projected points minus the position's replacement
// baseline (the projected points of the player at the position's last starter
// slot). Projected points are scored at the league's settings. null when a
// player has no projection or the position has no baseline.
export function computeVor(
  players: Player[],
  roster: RosterSettings,
  teams: number,
  scoring: Scoring,
  tePremium = false,
): Record<string, number | null> {
  const slots = replacementSlots(roster, teams);

  const pts = new Map<string, number | null>();
  const byPos: Record<string, number[]> = {};
  for (const p of players) {
    const v = projectedPoints(p, scoring, tePremium);
    pts.set(p.id, v);
    if (v != null) (byPos[p.position] ??= []).push(v);
  }
  for (const pos of Object.keys(byPos)) byPos[pos].sort((a, b) => b - a);

  const baseline: Record<string, number | null> = {};
  for (const pos of SCORERS) {
    const list = byPos[pos];
    const n = slots[pos];
    baseline[pos] =
      !list || list.length === 0 || n <= 0
        ? null
        : list[Math.min(n - 1, list.length - 1)];
  }

  const out: Record<string, number | null> = {};
  for (const p of players) {
    const v = pts.get(p.id) ?? null;
    const b = baseline[p.position];
    out[p.id] = v == null || b == null ? null : Math.round(v - b);
  }
  return out;
}

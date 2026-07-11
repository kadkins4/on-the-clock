import type { Player, Position } from "../../types";
import { servesNeed, type Needs } from "./roster";
import {
  strategyMultiplier,
  type StrategyId,
  type StrategyContext,
} from "./strategy";

const MAX_WINDOW = 12;
const RUN_BONUS = 1.5; // extra weight per recent pick at a player's position
const SPECIAL: Position[] = ["K", "DST"];
// How many best-available players a strategy reorders before the pick window is
// sliced. Bounds how far a personality can reach past raw ADP value.
const STRATEGY_CANDIDATE_CAP = 16;

// Reorder the best-available players by desirability × the strategy's position
// multiplier, so a personality can reshape *which* players fill the pick window
// — even in round 1, where the window is a single player. Desirability is a
// linear, ADP-based rank score (best-first); the multiplier bends it. Ties keep
// ADP order. Returns a new array; the input is untouched.
function applyStrategy(
  ranked: Player[],
  strategy: StrategyId,
  ctx: StrategyContext,
): Player[] {
  const cap = Math.min(ranked.length, STRATEGY_CANDIDATE_CAP);
  const scored = ranked.slice(0, cap).map((pl, i) => ({
    pl,
    i,
    score: (cap - i) * strategyMultiplier(strategy, pl, ctx),
  }));
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return [...scored.map((s) => s.pl), ...ranked.slice(cap)];
}

// Round 1 → window of 1 (near-deterministic); widens by 1 per round, capped.
export function pickWindowSize(round: number): number {
  return Math.min(MAX_WINDOW, round);
}

// Bots save K/DST for the end of the draft: they only become candidates once
// the team's remaining picks barely cover the open K/DST slots, with one round
// of slack. Until then bots take skill players (bench depth once starters are
// full) — the needs model has no bench concept, so without this gate a bot
// whose skill starters are filled would draft a kicker mid-draft.
function specialAllowed(needs: Needs, picksLeft: number): boolean {
  const open = (needs.base.K ?? 0) + (needs.base.DST ?? 0);
  return open > 0 && picksLeft <= open + 1;
}

// Pick from the best-available players that serve a roster need, within a
// round-scaled window, weighted so the top of the window is most likely.
// `available` must be sorted best-first (by blended adp, nulls last).
// `picksLeft` counts this team's remaining picks including the current one;
// the default (Infinity) keeps K/DST gated out.
export function botPick(
  available: Player[],
  needs: Needs,
  round: number,
  rng: () => number,
  recentPositions: Position[] = [],
  picksLeft: number = Infinity,
  strategy?: StrategyId,
  roster: Player[] = [],
): string {
  if (available.length === 0) throw new Error("botPick: no players available");

  const skillOnly = available.filter((pl) => !SPECIAL.includes(pl.position));
  const candidates =
    !specialAllowed(needs, picksLeft) && skillOnly.length > 0
      ? skillOnly
      : available;

  const needed = candidates.filter((pl) => servesNeed(pl.position, needs));
  const byAdp = needed.length > 0 ? needed : candidates;
  // A personality reorders the best-available set before the window is sliced;
  // absent a strategy the order is untouched, so behavior is unchanged.
  const ranked = strategy
    ? applyStrategy(byAdp, strategy, { round, needs, roster })
    : byAdp;

  const w = Math.min(pickWindowSize(round), ranked.length);
  const window = ranked.slice(0, w);

  // count recent picks per position to bias toward an ongoing run
  const runs: Partial<Record<Position, number>> = {};
  for (const pos of recentPositions) runs[pos] = (runs[pos] ?? 0) + 1;

  // linear decay (top of window heaviest) plus a run bonus for hot positions
  const weights = window.map(
    (pl, i) => w - i + RUN_BONUS * (runs[pl.position] ?? 0),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < window.length; i++) {
    r -= weights[i];
    if (r < 0) return window[i].id;
  }
  return window[window.length - 1].id;
}

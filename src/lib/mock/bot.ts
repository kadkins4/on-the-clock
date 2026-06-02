import type { Player, Position } from "../../types";
import { servesNeed, type Needs } from "./roster";

const MAX_WINDOW = 12;
const RUN_BONUS = 1.5; // extra weight per recent pick at a player's position

// Round 1 → window of 1 (near-deterministic); widens by 1 per round, capped.
export function pickWindowSize(round: number): number {
  return Math.min(MAX_WINDOW, round);
}

// Pick from the best-available players that serve a roster need, within a
// round-scaled window, weighted so the top of the window is most likely.
// `available` must be sorted best-first (by blended adp, nulls last).
export function botPick(
  available: Player[],
  needs: Needs,
  round: number,
  rng: () => number,
  recentPositions: Position[] = [],
): string {
  if (available.length === 0) throw new Error("botPick: no players available");

  const needed = available.filter((pl) => servesNeed(pl.position, needs));
  const ranked = needed.length > 0 ? needed : available;

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

// The draft formats the engine can actually run. (Auction is a separate,
// not-yet-built mode and is never passed here.)
export type DraftFormat = "snake" | "linear";

// Draft order as a flat array of team indices, one per overall pick.
// - "snake": rounds alternate direction. 3rd-round reversal (3RR) makes round 3
//   repeat round 2's direction instead of flipping, then snaking resumes.
// - "linear": every round runs in the same order (1→N); never reverses, so 3RR
//   does not apply.
export function buildDraftOrder(
  teams: number,
  rounds: number,
  thirdRoundReversal: boolean,
  format: DraftFormat = "snake",
): number[] {
  const order: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    // Plain snake: even rounds reverse. With 3RR, round 3 reverses again
    // (instead of flipping back), which inverts the parity for every round
    // from 3 onward — so odd rounds reverse and even rounds go forward.
    // Linear never reverses.
    const reversed =
      format === "linear"
        ? false
        : thirdRoundReversal && round >= 3
          ? round % 2 === 1
          : round % 2 === 0;
    const seq = Array.from({ length: teams }, (_, i) => i);
    order.push(...(reversed ? seq.reverse() : seq));
  }
  return order;
}

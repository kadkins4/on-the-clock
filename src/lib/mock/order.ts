// Snake draft order as a flat array of team indices, one per overall pick.
// 3rd-round reversal (3RR): round 3 repeats round 2's direction instead of
// flipping, then normal snaking resumes from round 4.
export function buildDraftOrder(
  teams: number,
  rounds: number,
  thirdRoundReversal: boolean,
): number[] {
  const order: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    // Plain snake: even rounds reverse. With 3RR, round 3 reverses again
    // (instead of flipping back), which inverts the parity for every round
    // from 3 onward — so odd rounds reverse and even rounds go forward.
    const reversed =
      thirdRoundReversal && round >= 3 ? round % 2 === 1 : round % 2 === 0;
    const seq = Array.from({ length: teams }, (_, i) => i);
    order.push(...(reversed ? seq.reverse() : seq));
  }
  return order;
}

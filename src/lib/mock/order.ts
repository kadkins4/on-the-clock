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
    let reversed = round % 2 === 0; // even rounds reverse in plain snake
    if (thirdRoundReversal && round === 3) reversed = true; // keep R2 direction
    const seq = Array.from({ length: teams }, (_, i) => i);
    order.push(...(reversed ? seq.reverse() : seq));
  }
  return order;
}

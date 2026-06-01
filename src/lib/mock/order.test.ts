import { describe, it, expect } from "vitest";
import { buildDraftOrder } from "./order";

describe("buildDraftOrder", () => {
  it("snakes: round 1 forward, round 2 reversed", () => {
    const order = buildDraftOrder(4, 3, false);
    // round1: 0 1 2 3 | round2: 3 2 1 0 | round3: 0 1 2 3
    expect(order).toEqual([0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3]);
  });

  it("applies 3rd-round reversal: round 3 keeps round 2's direction", () => {
    const order = buildDraftOrder(4, 4, true);
    // r1: 0123 | r2: 3210 | r3 (3RR keeps reversed): 3210 | r4 back to forward: 0123
    expect(order).toEqual([0, 1, 2, 3, 3, 2, 1, 0, 3, 2, 1, 0, 0, 1, 2, 3]);
  });

  it("produces teams*rounds picks", () => {
    expect(buildDraftOrder(12, 15, false)).toHaveLength(180);
  });
});

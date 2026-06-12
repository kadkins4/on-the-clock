import { describe, it, expect } from "vitest";
import { roundDirection } from "./boardDirection";
import { buildDraftOrder } from "./order";

describe("roundDirection", () => {
  // 1-team league always returns ltr (no second pick to compare)
  it("single-team league → always ltr", () => {
    const order = buildDraftOrder(1, 4, false);
    expect(roundDirection(order, 1, 1)).toBe("ltr");
    expect(roundDirection(order, 1, 2)).toBe("ltr");
    expect(roundDirection(order, 1, 3)).toBe("ltr");
  });

  // Plain snake (no 3RR): odd rounds ltr, even rounds rtl
  describe("plain snake (no 3RR)", () => {
    const teams = 4;
    const rounds = 6;
    const order = buildDraftOrder(teams, rounds, false);

    it("round 1 → ltr (team indices increase)", () => {
      expect(roundDirection(order, teams, 1)).toBe("ltr");
    });

    it("round 2 → rtl (team indices decrease)", () => {
      expect(roundDirection(order, teams, 2)).toBe("rtl");
    });

    it("round 3 → ltr", () => {
      expect(roundDirection(order, teams, 3)).toBe("ltr");
    });

    it("round 4 → rtl", () => {
      expect(roundDirection(order, teams, 4)).toBe("rtl");
    });

    it("round 5 → ltr", () => {
      expect(roundDirection(order, teams, 5)).toBe("ltr");
    });

    it("round 6 → rtl", () => {
      expect(roundDirection(order, teams, 6)).toBe("rtl");
    });
  });

  // 3RR snake: round 1 ltr, round 2 rtl, round 3 rtl (repeats r2), round 4 ltr, round 5 rtl…
  // From buildDraftOrder: rounds >= 3 with 3RR → reversed = round % 2 === 1 (for round >= 3).
  // So: round 1 (no 3RR logic) → not reversed (ltr)
  //     round 2 (no 3RR logic) → reversed (rtl)
  //     round 3 (3RR, odd) → reversed (rtl)
  //     round 4 (3RR, even) → not reversed (ltr)
  //     round 5 (3RR, odd) → reversed (rtl)
  //     round 6 (3RR, even) → not reversed (ltr)
  describe("3rd-round reversal (3RR)", () => {
    const teams = 4;
    const rounds = 6;
    const order = buildDraftOrder(teams, rounds, true);

    it("round 1 → ltr", () => {
      expect(roundDirection(order, teams, 1)).toBe("ltr");
    });

    it("round 2 → rtl", () => {
      expect(roundDirection(order, teams, 2)).toBe("rtl");
    });

    it("round 3 → rtl (3RR repeats r2 direction)", () => {
      expect(roundDirection(order, teams, 3)).toBe("rtl");
    });

    it("round 4 → ltr (parity flipped from round 4 on)", () => {
      expect(roundDirection(order, teams, 4)).toBe("ltr");
    });

    it("round 5 → rtl", () => {
      expect(roundDirection(order, teams, 5)).toBe("rtl");
    });

    it("round 6 → ltr", () => {
      expect(roundDirection(order, teams, 6)).toBe("ltr");
    });
  });

  // 2-team league sanity check
  describe("2-team snake (no 3RR)", () => {
    const order = buildDraftOrder(2, 4, false);
    // round 1: [0, 1] → ltr
    // round 2: [1, 0] → rtl
    // round 3: [0, 1] → ltr
    // round 4: [1, 0] → rtl
    it("round 1 → ltr", () => expect(roundDirection(order, 2, 1)).toBe("ltr"));
    it("round 2 → rtl", () => expect(roundDirection(order, 2, 2)).toBe("rtl"));
    it("round 3 → ltr", () => expect(roundDirection(order, 2, 3)).toBe("ltr"));
    it("round 4 → rtl", () => expect(roundDirection(order, 2, 4)).toBe("rtl"));
  });
});

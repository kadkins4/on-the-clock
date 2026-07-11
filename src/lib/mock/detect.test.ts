import { describe, it, expect } from "vitest";
import { detectStrategy } from "./detect";
import type { Position } from "../../types";

const p = (...xs: Position[]) => xs;

describe("detectStrategy — confidence ramp", () => {
  it("stays silent before three picks (not enough signal)", () => {
    expect(detectStrategy(p())).toEqual({ strategy: null, confidence: "low" });
    expect(detectStrategy(p("WR"))).toEqual({
      strategy: null,
      confidence: "low",
    });
    expect(detectStrategy(p("WR", "WR"))).toEqual({
      strategy: null,
      confidence: "low",
    });
  });

  it("gives a tentative (low-confidence) read at three picks", () => {
    const r = detectStrategy(p("WR", "WR", "WR"));
    expect(r.strategy).toBe("zeroRB");
    expect(r.confidence).toBe("low");
  });

  it("commits to a confident (high) read at four picks", () => {
    const r = detectStrategy(p("WR", "WR", "WR", "WR"));
    expect(r.strategy).toBe("zeroRB");
    expect(r.confidence).toBe("high");
  });
});

describe("detectStrategy — reads the RB-timing axis", () => {
  it("no RB through the early picks → Zero RB", () => {
    expect(detectStrategy(p("WR", "TE", "WR")).strategy).toBe("zeroRB");
  });

  it("one RB taken at pick 1, then WRs → Hero RB", () => {
    expect(detectStrategy(p("RB", "WR", "WR")).strategy).toBe("heroRB");
  });

  it("two or more RBs early → Robust RB", () => {
    expect(detectStrategy(p("RB", "RB", "WR")).strategy).toBe("robustRB");
    expect(detectStrategy(p("RB", "RB", "RB")).strategy).toBe("robustRB");
  });

  it("a single RB that was not the anchor pick reads as balanced", () => {
    expect(detectStrategy(p("WR", "RB", "WR")).strategy).toBe("balanced");
  });
});

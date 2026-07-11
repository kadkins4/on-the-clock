import { describe, it, expect } from "vitest";
import { nudgeCopy } from "./nudge";

describe("nudgeCopy", () => {
  it("is null when there's no detected strategy yet", () => {
    expect(nudgeCopy({ strategy: null, confidence: "low" })).toBeNull();
  });

  it("is tentative at low confidence (three picks)", () => {
    const c = nudgeCopy({ strategy: "zeroRB", confidence: "low" })!;
    expect(c.name).toBe("Zero RB");
    expect(c.icon).toBe("0️⃣");
    expect(c.tentative).toBe(true);
    expect(c.headline.toLowerCase()).toContain("looks like");
  });

  it("commits at high confidence (four picks)", () => {
    const c = nudgeCopy({ strategy: "zeroRB", confidence: "high" })!;
    expect(c.tentative).toBe(false);
    expect(c.headline.toLowerCase()).toContain("you're running");
  });

  it("carries a target hint for each detectable strategy", () => {
    for (const id of ["zeroRB", "heroRB", "robustRB", "balanced"] as const) {
      const c = nudgeCopy({ strategy: id, confidence: "high" })!;
      expect(c.hint.length).toBeGreaterThan(0);
    }
  });
});

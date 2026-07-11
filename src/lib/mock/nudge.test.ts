import { describe, it, expect } from "vitest";
import { nudgeCopy } from "./nudge";

describe("nudgeCopy", () => {
  it("is null when there's no detected strategy", () => {
    expect(nudgeCopy(null)).toBeNull();
  });

  it("returns the plain strategy name, icon, and a committed headline", () => {
    const c = nudgeCopy("zeroRB")!;
    expect(c.name).toBe("Zero RB");
    expect(c.icon).toBe("0️⃣");
    expect(c.headline.toLowerCase()).toContain("you're running");
  });

  it("carries a target hint for each detectable strategy", () => {
    for (const id of ["zeroRB", "heroRB", "robustRB", "balanced"] as const) {
      const c = nudgeCopy(id)!;
      expect(c.hint.length).toBeGreaterThan(0);
    }
  });
});

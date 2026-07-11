import { describe, it, expect } from "vitest";
import { nudgeCopy, shouldShowNudge } from "./nudge";
import type { DetectedStrategy } from "./detect";

describe("shouldShowNudge — confidence gate", () => {
  const det = (
    strategy: DetectedStrategy["strategy"],
    confidence: DetectedStrategy["confidence"],
  ): DetectedStrategy => ({ strategy, confidence });

  it("is hidden when there is no detected strategy", () => {
    expect(shouldShowNudge(det(null, "low"), null)).toBe(false);
    expect(shouldShowNudge(det(null, "high"), null)).toBe(false);
  });

  it("stays hidden at low confidence (the tentative 3-pick read)", () => {
    expect(shouldShowNudge(det("zeroRB", "low"), null)).toBe(false);
  });

  it("shows once the read is confident (4th pick) and undismissed", () => {
    expect(shouldShowNudge(det("zeroRB", "high"), null)).toBe(true);
  });

  it("hides a strategy the user has dismissed", () => {
    expect(shouldShowNudge(det("zeroRB", "high"), "zeroRB")).toBe(false);
  });

  it("still shows a different strategy after one was dismissed", () => {
    expect(shouldShowNudge(det("heroRB", "high"), "zeroRB")).toBe(true);
  });
});

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

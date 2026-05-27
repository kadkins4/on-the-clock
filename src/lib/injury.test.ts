import { describe, it, expect } from "vitest";
import { injuryBadge } from "./injury";

describe("injuryBadge", () => {
  it("maps ESPN statuses to short code + severity", () => {
    expect(injuryBadge("QUESTIONABLE")).toEqual({
      code: "Q",
      severity: "minor",
    });
    expect(injuryBadge("DOUBTFUL")).toEqual({ code: "D", severity: "minor" });
    expect(injuryBadge("OUT")).toEqual({ code: "O", severity: "major" });
    expect(injuryBadge("INJURY_RESERVE")).toEqual({
      code: "IR",
      severity: "major",
    });
    expect(injuryBadge("SUSPENSION")).toEqual({
      code: "SUS",
      severity: "major",
    });
  });

  it("returns null for healthy / unknown / undefined", () => {
    expect(injuryBadge("ACTIVE")).toBeNull();
    expect(injuryBadge(undefined)).toBeNull();
    expect(injuryBadge("WHATEVER")).toBeNull();
  });
});

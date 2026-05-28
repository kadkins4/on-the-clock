import { describe, it, expect } from "vitest";
import { injuryBadge } from "./injury";

describe("injuryBadge", () => {
  it("maps ESPN statuses to code + severity", () => {
    expect(injuryBadge("QUESTIONABLE")).toMatchObject({
      code: "Q",
      severity: "minor",
    });
    expect(injuryBadge("DOUBTFUL")).toMatchObject({
      code: "D",
      severity: "minor",
    });
    expect(injuryBadge("OUT")).toMatchObject({ code: "O", severity: "major" });
    expect(injuryBadge("INJURY_RESERVE")).toMatchObject({
      code: "IR",
      severity: "major",
    });
    expect(injuryBadge("SUSPENSION")).toMatchObject({
      code: "SUS",
      severity: "major",
    });
  });

  it("provides a label and a meaning/timeline description for the tooltip", () => {
    expect(injuryBadge("QUESTIONABLE")).toMatchObject({
      label: "Questionable",
      description: "game-time decision, about 50/50 to play this week.",
    });
    expect(injuryBadge("OUT")).toMatchObject({
      label: "Out",
      description: "Will not play this week.",
    });
    expect(injuryBadge("INJURY_RESERVE")).toMatchObject({
      label: "Injured Reserve",
      description: "Out at least 4 games; could return later in the season.",
    });
  });

  it("returns null for healthy / unknown / undefined", () => {
    expect(injuryBadge("ACTIVE")).toBeNull();
    expect(injuryBadge(undefined)).toBeNull();
    expect(injuryBadge("WHATEVER")).toBeNull();
  });
});

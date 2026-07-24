import { describe, it, expect } from "vitest";
import { buildAnnouncement, spokenPosition } from "./phrase";

describe("spokenPosition", () => {
  it("expands every position code to a spoken form", () => {
    expect(spokenPosition("QB")).toBe("quarterback");
    expect(spokenPosition("RB")).toBe("running back");
    expect(spokenPosition("WR")).toBe("wide receiver");
    expect(spokenPosition("TE")).toBe("tight end");
    expect(spokenPosition("K")).toBe("kicker");
    expect(spokenPosition("DST")).toBe("defense");
  });

  it("falls back to the raw code for anything unrecognized", () => {
    expect(spokenPosition("XX")).toBe("XX");
  });
});

describe("buildAnnouncement", () => {
  const base = {
    overall: 17,
    name: "Jahmyr Gibbs",
    position: "RB",
    signal: null,
  };

  it("reads pick number, spoken position, then full name", () => {
    expect(buildAnnouncement(base)).toBe(
      "With pick 17, running back Jahmyr Gibbs.",
    );
  });

  it("never abbreviates the player name", () => {
    const out = buildAnnouncement({ ...base, name: "Amon-Ra St. Brown" });
    expect(out).toContain("Amon-Ra St. Brown");
  });

  it("appends a flair line on a reach", () => {
    const out = buildAnnouncement({
      ...base,
      signal: { kind: "reach", amount: 30 },
    });
    expect(out).toContain("With pick 17, running back Jahmyr Gibbs.");
    expect(out.length).toBeGreaterThan(base.name.length);
    expect(out).toMatch(/reach/i);
  });

  it("appends a different flair line on a value", () => {
    const out = buildAnnouncement({
      ...base,
      signal: { kind: "value", amount: 30 },
    });
    expect(out).toContain("With pick 17, running back Jahmyr Gibbs.");
    expect(out).not.toMatch(/reach/i);
    expect(out.length).toBeGreaterThan(buildAnnouncement(base).length);
  });

  it("stays quiet when there is no signal", () => {
    expect(buildAnnouncement(base)).toBe(
      "With pick 17, running back Jahmyr Gibbs.",
    );
  });

  it("keeps flair short — every character is a credit", () => {
    const withFlair = buildAnnouncement({
      ...base,
      signal: { kind: "reach", amount: 30 },
    });
    const plain = buildAnnouncement(base);
    expect(withFlair.length - plain.length).toBeLessThanOrEqual(30);
  });
});

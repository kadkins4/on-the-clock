import { describe, it, expect } from "vitest";
import { POSITION_COLOR, POSITION_KEY, positionColor } from "./positionColor";
import { POSITIONS } from "../types";

const OKLCH = /^oklch\([\d.]+ [\d.]+ \d+\)$/;

describe("positionColor", () => {
  it("maps every Position to an OKLCH badge color", () => {
    for (const pos of POSITIONS) {
      expect(POSITION_COLOR[pos]).toMatch(OKLCH);
    }
  });
  it("positionColor() returns the mapped badge color", () => {
    expect(positionColor("QB")).toBe(POSITION_COLOR.QB);
    expect(positionColor("QB")).toBe(POSITION_KEY.QB.badge);
  });
  it("distinct badges for QB/RB/WR/TE", () => {
    const c = [
      POSITION_COLOR.QB,
      POSITION_COLOR.RB,
      POSITION_COLOR.WR,
      POSITION_COLOR.TE,
    ];
    expect(new Set(c).size).toBe(4);
  });
});

describe("POSITION_KEY", () => {
  it("every position has OKLCH badge / tint / subtext", () => {
    for (const pos of POSITIONS) {
      const k = POSITION_KEY[pos];
      expect(k.badge).toMatch(OKLCH);
      expect(k.tint).toMatch(OKLCH);
      expect(k.subtext).toMatch(OKLCH);
    }
  });
  it("badge text is white except TE (#1A1407)", () => {
    expect(POSITION_KEY.TE.badgeText).toBe("#1A1407");
    for (const pos of POSITIONS) {
      if (pos === "TE") continue;
      expect(POSITION_KEY[pos].badgeText).toBe("#fff");
    }
  });
  it("matches the design Position key table exactly", () => {
    expect(POSITION_KEY).toEqual({
      QB: {
        badge: "oklch(0.62 0.14 30)",
        tint: "oklch(0.26 0.04 30)",
        subtext: "oklch(0.72 0.06 30)",
        badgeText: "#fff",
      },
      RB: {
        badge: "oklch(0.62 0.14 150)",
        tint: "oklch(0.26 0.04 150)",
        subtext: "oklch(0.72 0.06 150)",
        badgeText: "#fff",
      },
      WR: {
        badge: "oklch(0.62 0.14 250)",
        tint: "oklch(0.26 0.04 250)",
        subtext: "oklch(0.72 0.06 250)",
        badgeText: "#fff",
      },
      TE: {
        badge: "oklch(0.66 0.13 75)",
        tint: "oklch(0.27 0.05 75)",
        subtext: "oklch(0.74 0.07 75)",
        badgeText: "#1A1407",
      },
      K: {
        badge: "oklch(0.62 0.14 310)",
        tint: "oklch(0.26 0.04 310)",
        subtext: "oklch(0.72 0.06 310)",
        badgeText: "#fff",
      },
      DST: {
        badge: "oklch(0.62 0.14 200)",
        tint: "oklch(0.26 0.04 200)",
        subtext: "oklch(0.72 0.06 200)",
        badgeText: "#fff",
      },
    });
  });
});

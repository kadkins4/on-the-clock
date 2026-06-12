import { describe, it, expect } from "vitest";
import { formatNeeds } from "./formatNeeds";
import type { Needs } from "./roster";

describe("formatNeeds", () => {
  it("formats all-zero needs", () => {
    const needs: Needs = {
      base: {},
      flex: 0,
      superflex: 0,
    };
    expect(formatNeeds(needs)).toBe("QB0 · RB0 · WR0 · TE0 · K0 · DST0");
  });

  it("formats typical starter needs", () => {
    const needs: Needs = {
      base: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 },
      flex: 0,
      superflex: 0,
    };
    expect(formatNeeds(needs)).toBe("QB1 · RB2 · WR2 · TE1 · K1 · DST1");
  });

  it("shows FLEX count when > 0", () => {
    const needs: Needs = {
      base: { QB: 1 },
      flex: 2,
      superflex: 0,
    };
    const result = formatNeeds(needs);
    expect(result).toContain("FLEX2");
    expect(result).toContain("QB1");
  });

  it("shows SUPERFLEX count when > 0", () => {
    const needs: Needs = {
      base: {},
      flex: 0,
      superflex: 1,
    };
    const result = formatNeeds(needs);
    expect(result).toContain("SFX1");
  });

  it("omits FLEX and SUPERFLEX when 0", () => {
    const needs: Needs = {
      base: { QB: 1 },
      flex: 0,
      superflex: 0,
    };
    const result = formatNeeds(needs);
    expect(result).not.toContain("FLEX");
    expect(result).not.toContain("SFX");
  });

  it("handles partial base (missing positions default to 0)", () => {
    const needs: Needs = {
      base: { RB: 1 },
      flex: 0,
      superflex: 0,
    };
    expect(formatNeeds(needs)).toBe("QB0 · RB1 · WR0 · TE0 · K0 · DST0");
  });
});

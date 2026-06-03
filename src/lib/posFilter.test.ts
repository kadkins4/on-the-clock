import { describe, it, expect } from "vitest";
import {
  FLEX_SET,
  SFLEX_SET,
  toggleChip,
  applyMacro,
  matchesPosFilter,
  setsEqual,
  rosteredPositions,
  chipConfig,
} from "./posFilter";
import type { Position, RosterSettings } from "../types";

const roster = (over: Partial<RosterSettings> = {}): RosterSettings => ({
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  K: 1,
  DST: 1,
  bench: 6,
  disabled: [],
  ...over,
});

const set = (...p: Position[]) => new Set<Position>(p);

describe("matchesPosFilter", () => {
  it("empty set matches every position (ALL)", () => {
    expect(matchesPosFilter(set(), "QB")).toBe(true);
    expect(matchesPosFilter(set(), "DST")).toBe(true);
  });
  it("non-empty set matches only members", () => {
    const f = set("RB", "WR");
    expect(matchesPosFilter(f, "RB")).toBe(true);
    expect(matchesPosFilter(f, "WR")).toBe(true);
    expect(matchesPosFilter(f, "QB")).toBe(false);
  });
});

describe("toggleChip", () => {
  it("adds a position not present", () => {
    expect(setsEqual(toggleChip(set("RB"), "WR"), set("RB", "WR"))).toBe(true);
  });
  it("removes a position already present", () => {
    expect(setsEqual(toggleChip(set("RB", "WR"), "RB"), set("WR"))).toBe(true);
  });
  it("does not mutate the input set", () => {
    const a = set("RB");
    toggleChip(a, "WR");
    expect(setsEqual(a, set("RB"))).toBe(true);
  });
});

describe("applyMacro", () => {
  it("FLEX sets the active set to {RB,WR,TE}", () => {
    expect(setsEqual(applyMacro(set("QB"), "FLEX"), FLEX_SET)).toBe(true);
  });
  it("SFLEX sets the active set to {QB,RB,WR,TE}", () => {
    expect(setsEqual(applyMacro(set(), "SFLEX"), SFLEX_SET)).toBe(true);
  });
  it("clicking an active macro again clears the filter", () => {
    expect(setsEqual(applyMacro(new Set(FLEX_SET), "FLEX"), set())).toBe(true);
  });
  it("ALL clears the filter", () => {
    expect(setsEqual(applyMacro(set("RB", "WR"), "ALL"), set())).toBe(true);
  });
});

describe("rosteredPositions", () => {
  it("includes positions with count > 0, in canonical order", () => {
    expect(rosteredPositions(roster())).toEqual([
      "QB",
      "RB",
      "WR",
      "TE",
      "K",
      "DST",
    ]);
  });
  it("drops positions with zero count", () => {
    expect(rosteredPositions(roster({ K: 0, DST: 0 }))).toEqual([
      "QB",
      "RB",
      "WR",
      "TE",
    ]);
  });
  it("drops disabled positions even if count > 0", () => {
    expect(rosteredPositions(roster({ disabled: ["K"] }))).toEqual([
      "QB",
      "RB",
      "WR",
      "TE",
      "DST",
    ]);
  });
});

describe("chipConfig", () => {
  it("standard roster: positions + FLEX, no SFLEX", () => {
    const c = chipConfig(roster());
    expect(c.positions).toEqual(["QB", "RB", "WR", "TE", "K", "DST"]);
    expect(c.flex).toBe(true);
    expect(c.sflex).toBe(false);
  });
  it("superflex roster shows SFLEX", () => {
    expect(chipConfig(roster({ SUPERFLEX: 1 })).sflex).toBe(true);
  });
  it("no FLEX-eligible positions hides FLEX", () => {
    expect(chipConfig(roster({ RB: 0, WR: 0, TE: 0 })).flex).toBe(false);
  });
});

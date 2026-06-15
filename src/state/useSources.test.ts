import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSources } from "./useSources";
import type { SourcesResponse } from "../lib/sources/types";

const res: SourcesResponse = {
  sources: {
    "4430807": {
      espnId: "4430807",
      name: "Bijan Robinson",
      position: "RB",
      ids: { sleeper: "9509" },
      fantasycalc: {
        id: 1,
        value: 10000,
        redraftValue: null,
        overallRank: 1,
        positionRank: 1,
        adp: 1.6,
        trend30Day: null,
        tier: 1,
        team: "ATL",
        age: 24,
        heightInches: 71,
        weightLbs: 215,
        college: "Texas",
        yearsExp: 3,
      },
    },
  },
  meta: { count: 1, sources: ["fantasycalc"], season: 2026 },
};

beforeEach(() => localStorage.clear());

describe("useSources", () => {
  it("starts empty when nothing is persisted", () => {
    const { result } = renderHook(() => useSources());
    expect(result.current.sourcesMeta).toBeNull();
    expect(Object.keys(result.current.sources)).toHaveLength(0);
  });

  it("stores and persists a fetched response across remounts", () => {
    const first = renderHook(() => useSources());
    act(() => first.result.current.setSources(res));
    expect(first.result.current.sourcesMeta?.count).toBe(1);
    expect(first.result.current.sources["4430807"].name).toBe("Bijan Robinson");
    expect(first.result.current.sourcesFetchedAt).toBeGreaterThan(0);

    // a fresh mount reads it back from localStorage
    const second = renderHook(() => useSources());
    expect(second.result.current.sources["4430807"].fantasycalc?.adp).toBe(1.6);
    expect(second.result.current.sourcesMeta?.sources).toEqual(["fantasycalc"]);
  });
});

import { describe, it, expect } from "vitest";
import { mapFantasyCalc } from "./fantasycalc";
import { mapSleeperProjections } from "./sleeper";
import { buildSources } from "./build";

const fcJson = [
  {
    player: {
      id: 9833,
      name: "Bijan Robinson",
      position: "RB",
      espnId: "4430807",
      sleeperId: "9509",
      mflId: "16161",
      maybeTeam: "ATL",
      maybeAge: 24.4,
      maybeHeight: "71",
      maybeWeight: 215,
      maybeCollege: "Texas",
      maybeYoe: 3,
    },
    value: 10427,
    redraftValue: 9000,
    overallRank: 1,
    positionRank: 1,
    maybeAdp: 1.6,
    trend30Day: 9,
    maybeTier: 1,
  },
  {
    // no espnId → must be skipped (can't join to board)
    player: { id: 5, name: "Ghost Player", position: "WR", sleeperId: "999" },
    value: 1,
  },
];

const sleeperJson = [
  {
    player_id: "9509", // Bijan, joins via crosswalk
    stats: {
      adp_ppr: 1.6,
      adp_half_ppr: 1.7,
      adp_std: 2.0,
      adp_2qb: 3.0,
      adp_dynasty_ppr: 1.1,
      adp_rookie: 999,
      pts_ppr: 290,
      pts_half_ppr: 278,
      pts_std: 266,
      gp: 17,
      rush_yd: 1400,
      rush_td: 12,
      rec: 60,
    },
  },
  {
    player_id: "00000", // not in crosswalk → dropped
    stats: { pts_ppr: 100 },
  },
];

describe("mapFantasyCalc", () => {
  it("keys by espnId, builds the sleeper→espn crosswalk, skips rows without espnId", () => {
    const { byEspnId, sleeperToEspn } = mapFantasyCalc(fcJson);
    expect(byEspnId.size).toBe(1);
    expect(byEspnId.has("4430807")).toBe(true);
    expect(sleeperToEspn.get("9509")).toBe("4430807");

    const row = byEspnId.get("4430807")!;
    expect(row.name).toBe("Bijan Robinson");
    expect(row.ids.sleeper).toBe("9509");
    expect(row.fantasycalc.adp).toBe(1.6);
    expect(row.fantasycalc.heightInches).toBe(71);
    expect(row.fantasycalc.college).toBe("Texas");
  });

  it("returns empty maps for non-array input", () => {
    const { byEspnId } = mapFantasyCalc(null);
    expect(byEspnId.size).toBe(0);
  });
});

describe("mapSleeperProjections", () => {
  it("keys by espnId via crosswalk, splits adp/pts from the raw stat line", () => {
    const cross = new Map([["9509", "4430807"]]);
    const m = mapSleeperProjections(sleeperJson, cross);
    expect(m.size).toBe(1); // the uncrosswalked row is dropped

    const s = m.get("4430807")!;
    expect(s.adp.ppr).toBe(1.6);
    expect(s.adp.dynastyPpr).toBe(1.1);
    expect(s.proj.ppr).toBe(290);
    expect(s.gamesProjected).toBe(17);
    // raw counting stats kept, adp_/pts_ removed
    expect(s.stats.rush_yd).toBe(1400);
    expect(s.stats.rec).toBe(60);
    expect(s.stats.adp_ppr).toBeUndefined();
    expect(s.stats.pts_ppr).toBeUndefined();
  });
});

describe("buildSources", () => {
  it("joins Sleeper onto FantasyCalc by espnId", () => {
    const { store, contributed } = buildSources(fcJson, sleeperJson);
    expect(Object.keys(store)).toEqual(["4430807"]);
    expect(contributed).toEqual(["fantasycalc", "sleeper"]);

    const entry = store["4430807"];
    expect(entry.fantasycalc?.value).toBe(10427);
    expect(entry.sleeper?.proj.ppr).toBe(290);
  });

  it("works FantasyCalc-only when Sleeper is empty", () => {
    const { store, contributed } = buildSources(fcJson, []);
    expect(store["4430807"].sleeper).toBeUndefined();
    expect(contributed).toEqual(["fantasycalc"]);
  });

  it("yields an empty store when FantasyCalc (the crosswalk) is missing", () => {
    const { store, contributed } = buildSources(null, sleeperJson);
    expect(Object.keys(store)).toHaveLength(0);
    expect(contributed).toEqual([]);
  });
});

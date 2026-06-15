import { describe, it, expect } from "vitest";
import { mapFantasyCalc } from "./fantasycalc";
import { mapSleeperProjections } from "./sleeper";
import { mapSleeperPlayers } from "./sleeperPlayers";
import { buildSources } from "./build";

// Sleeper player map — keyed by sleeper id, carries espn_id + bio.
const playerMap = {
  // Bijan has a NULL espn_id in Sleeper's map (true in production) — he must
  // still join via FantasyCalc's crosswalk, with bio resolved by sleeper id.
  "9509": {
    espn_id: null,
    full_name: "Bijan Robinson",
    position: "RB",
    team: "ATL",
    age: 24,
    college: "Texas",
    height: "71",
    weight: "215",
    years_exp: 3,
    status: "Active",
    injury_status: null,
    depth_chart_position: "RB",
    number: 7,
  },
  "3198": {
    espn_id: "3000",
    full_name: "Derrick Henry",
    position: "RB",
    team: "BAL",
    injury_status: "Questionable",
  },
};

const projections = [
  {
    player_id: "9509",
    stats: { pts_ppr: 290, adp_ppr: 1.6, gp: 17, rush_yd: 1400, rec: 60 },
  },
  { player_id: "3198", stats: { pts_ppr: 288, rush_yd: 1900 } }, // in map, not in FC
  { player_id: "00000", stats: { pts_ppr: 50 } }, // not in map → dropped
];

const fc = [
  {
    player: {
      id: 1,
      name: "Bijan Robinson",
      position: "RB",
      espnId: "4430807",
      sleeperId: "9509",
      maybeTeam: "ATL",
    },
    value: 10000,
    maybeAdp: 1.6,
  },
];

describe("mapSleeperPlayers", () => {
  it("keys bio by sleeper id (always present) and crosswalks only where espn_id exists", () => {
    const { bySleeperId, sleeperToEspn } = mapSleeperPlayers(playerMap);
    expect(bySleeperId.size).toBe(2);
    // Bijan has a null espn_id → not in the crosswalk, but bio is still captured
    expect(sleeperToEspn.has("9509")).toBe(false);
    expect(sleeperToEspn.get("3198")).toBe("3000");
    const bijan = bySleeperId.get("9509")!;
    expect(bijan.bio.college).toBe("Texas");
    expect(bijan.bio.heightInches).toBe(71);
    expect(bySleeperId.get("3198")!.bio.injuryStatus).toBe("Questionable");
  });
});

describe("buildSources", () => {
  it("joins player map + projections + FantasyCalc by espn id", () => {
    const { store, contributed } = buildSources(playerMap, projections, fc);
    expect(contributed).toEqual(["sleeper", "fantasycalc"]);

    const bijan = store["4430807"];
    expect(bijan.name).toBe("Bijan Robinson");
    expect(bijan.bio?.college).toBe("Texas");
    expect(bijan.sleeper?.proj.ppr).toBe(290);
    expect(bijan.sleeper?.stats.rush_yd).toBe(1400);
    expect(bijan.fantasycalc?.value).toBe(10000);
    expect(bijan.ids.sleeper).toBe("9509");
  });

  it("covers players beyond FantasyCalc's list (projections-only)", () => {
    const { store } = buildSources(playerMap, projections, fc);
    // Derrick Henry has a projection + map bio but no FantasyCalc row
    const henry = store["3000"];
    expect(henry).toBeDefined();
    expect(henry.sleeper?.proj.ppr).toBe(288);
    expect(henry.bio?.injuryStatus).toBe("Questionable");
    expect(henry.fantasycalc).toBeUndefined();
  });

  it("works FantasyCalc-only when Sleeper is missing", () => {
    const { store, contributed } = buildSources(null, null, fc);
    expect(contributed).toEqual(["fantasycalc"]);
    expect(store["4430807"].fantasycalc?.value).toBe(10000);
    expect(store["4430807"].bio).toBeUndefined();
    expect(store["4430807"].sleeper).toBeUndefined();
  });

  it("yields an empty store when every feed is missing", () => {
    const { store, contributed } = buildSources(null, null, null);
    expect(Object.keys(store)).toHaveLength(0);
    expect(contributed).toEqual([]);
  });
});

// Unchanged sub-mappers still covered.
describe("mapFantasyCalc", () => {
  it("keys by espnId and reads value/bio fields", () => {
    const { byEspnId } = mapFantasyCalc(fc);
    expect(byEspnId.get("4430807")!.fantasycalc.adp).toBe(1.6);
  });
});

describe("mapSleeperProjections", () => {
  it("splits adp/pts from the raw stat line", () => {
    const cross = new Map([["9509", "4430807"]]);
    const m = mapSleeperProjections(projections, cross);
    const s = m.get("4430807")!;
    expect(s.proj.ppr).toBe(290);
    expect(s.stats.rush_yd).toBe(1400);
    expect(s.stats.pts_ppr).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { mapFantasyCalc } from "./fantasycalc";
import { mapSleeperProjections } from "./sleeper";
import { mapSleeperPlayers } from "./sleeperPlayers";
import { mapDynastyIds } from "./dynastyProcess";
import { mapNflverseStats } from "./nflverse";
import { buildSources } from "./build";

// Sleeper player map — Bijan has a NULL espn_id (true in production); he must
// still join via the DynastyProcess / FantasyCalc crosswalks.
const playerMap = {
  "9509": {
    espn_id: null,
    full_name: "Bijan Robinson",
    position: "RB",
    team: "ATL",
    injury_status: "Questionable",
    depth_chart_position: "RB",
  },
  "3198": { espn_id: "3000", full_name: "Derrick Henry", position: "RB" },
};

const projections = [
  { player_id: "9509", stats: { pts_ppr: 290, adp_ppr: 1.6, rush_yd: 1400 } },
  { player_id: "3198", stats: { pts_ppr: 288 } },
  { player_id: "00000", stats: { pts_ppr: 50 } }, // not crosswalked → dropped
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

const dpCsv = [
  "espn_id,sleeper_id,gsis_id,mfl_id,fleaflicker_id,pfr_id,fantasypros_id,name,position,team,birthdate,age,draft_year,draft_round,draft_pick,draft_ovr,height,weight,college",
  "4430807,9509,G1,16161,17603,RobiBi00,23046,Bijan Robinson,RB,ATL,2002-01-30,24,2023,1,8,8,71,215,Texas",
  "3000,3198,G2,NA,NA,HenrDe00,NA,Derrick Henry,RB,BAL,1994-01-04,30,2016,2,13,45,75,247,Alabama",
].join("\n");

const nflverseCsv = [
  "player_id,season,games,passing_yards,passing_tds,passing_interceptions,passing_epa,carries,rushing_yards,rushing_tds,rushing_epa,receptions,targets,receiving_yards,receiving_tds,receiving_epa,target_share,air_yards_share,fantasy_points_ppr",
  "G1,2024,17,0,0,0,NA,304,1456,14,12.5,61,72,431,1,8.2,0.18,0.05,330.7",
  "G2,2024,17,0,0,0,NA,325,1921,16,20.1,19,22,193,2,5.0,0.06,0.02,290.0",
].join("\n");

describe("mapDynastyIds", () => {
  it("keys by espn id and yields sleeper→espn + gsis→espn crosswalks", () => {
    const { byEspnId, sleeperToEspn, gsisToEspn } = mapDynastyIds(dpCsv);
    expect(byEspnId.size).toBe(2);
    expect(sleeperToEspn.get("9509")).toBe("4430807");
    expect(gsisToEspn.get("G1")).toBe("4430807");
    const bijan = byEspnId.get("4430807")!;
    expect(bijan.ids.gsis).toBe("G1");
    expect(bijan.ids.pfr).toBe("RobiBi00");
    expect(bijan.draft).toEqual({ year: 2023, round: 1, pick: 8, overall: 8 });
    expect(bijan.college).toBe("Texas");
    // NA cells read as null
    expect(byEspnId.get("3000")!.ids.mfl).toBeUndefined();
  });
});

describe("mapNflverseStats", () => {
  it("keys by espn id via the gsis crosswalk and reads advanced stats", () => {
    const cross = new Map([
      ["G1", "4430807"],
      ["G2", "3000"],
    ]);
    const m = mapNflverseStats(nflverseCsv, cross);
    const bijan = m.get("4430807")!;
    expect(bijan.rushYards).toBe(1456);
    expect(bijan.targetShare).toBe(0.18);
    expect(bijan.fantasyPointsPpr).toBe(330.7);
    expect(bijan.season).toBe(2024);
  });
});

describe("buildSources", () => {
  it("joins all five feeds into one espn-id store", () => {
    const { store, contributed } = buildSources(
      playerMap,
      projections,
      fc,
      dpCsv,
      nflverseCsv,
    );
    expect(contributed).toEqual([
      "sleeper",
      "fantasycalc",
      "dynastyprocess",
      "nflverse",
    ]);

    const bijan = store["4430807"]; // null Sleeper espn_id, joined via DP/FC
    expect(bijan.name).toBe("Bijan Robinson");
    expect(bijan.sleeper?.proj.ppr).toBe(290);
    expect(bijan.fantasycalc?.value).toBe(10000);
    expect(bijan.draft?.round).toBe(1);
    expect(bijan.nflverse?.rushYards).toBe(1456);
    expect(bijan.bio?.injuryStatus).toBe("Questionable"); // from Sleeper map
    expect(bijan.bio?.college).toBe("Texas"); // backfilled from DP
    expect(bijan.ids.gsis).toBe("G1");
  });

  it("covers a projections-only player (no FantasyCalc) with stats + pedigree", () => {
    const { store } = buildSources(
      playerMap,
      projections,
      fc,
      dpCsv,
      nflverseCsv,
    );
    const henry = store["3000"];
    expect(henry.sleeper?.proj.ppr).toBe(288);
    expect(henry.nflverse?.rushYards).toBe(1921);
    expect(henry.draft?.round).toBe(2);
    expect(henry.fantasycalc).toBeUndefined();
  });

  it("degrades to FantasyCalc-only when every other feed is empty", () => {
    const { store, contributed } = buildSources(null, null, fc, "", "");
    expect(contributed).toEqual(["fantasycalc"]);
    expect(store["4430807"].fantasycalc?.value).toBe(10000);
    expect(store["4430807"].nflverse).toBeUndefined();
    expect(store["4430807"].draft).toBeUndefined();
  });

  it("yields an empty store when every feed is missing", () => {
    const { store, contributed } = buildSources(null, null, null, "", "");
    expect(Object.keys(store)).toHaveLength(0);
    expect(contributed).toEqual([]);
  });
});

// Unchanged sub-mappers still covered.
describe("sub-mappers", () => {
  it("mapSleeperPlayers keys bio by sleeper id", () => {
    const { bySleeperId } = mapSleeperPlayers(playerMap);
    expect(bySleeperId.get("9509")!.bio.injuryStatus).toBe("Questionable");
  });
  it("mapFantasyCalc keys by espnId", () => {
    const { byEspnId } = mapFantasyCalc(fc);
    expect(byEspnId.get("4430807")!.fantasycalc.adp).toBe(1.6);
  });
  it("mapSleeperProjections splits adp/pts from the raw stat line", () => {
    const m = mapSleeperProjections(
      projections,
      new Map([["9509", "4430807"]]),
    );
    expect(m.get("4430807")!.stats.rush_yd).toBe(1400);
  });
});

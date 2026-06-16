import { describe, it, expect } from "vitest";
import { handleSources } from "./sources";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => "",
  } as unknown as Response;
}

function textResponse(text: string, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => ({}),
    text: async () => text,
  } as unknown as Response;
}

const playerMap = {
  "9509": {
    espn_id: "4430807",
    full_name: "Bijan Robinson",
    position: "RB",
    team: "ATL",
    college: "Texas",
  },
};

const projections = [
  { player_id: "9509", stats: { pts_ppr: 290, adp_ppr: 1.6, rush_yd: 1400 } },
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
  "espn_id,sleeper_id,gsis_id,name,position,draft_year,draft_round,draft_pick,draft_ovr",
  "4430807,9509,G1,Bijan Robinson,RB,2023,1,8,8",
].join("\n");

const nflverseCsv = [
  "player_id,season,games,rushing_yards,target_share,fantasy_points_ppr",
  "G1,2024,17,1456,0.18,330.7",
].join("\n");

interface RouterOpts {
  okMap?: boolean;
  okProj?: boolean;
  okCalc?: boolean;
  okDp?: boolean;
  okNfl?: boolean;
}

// Route fake URLs. Player map is /v1/players/nfl, projections /projections/nfl,
// DynastyProcess db_playerids.csv, nflverse stats_player. CSV feeds → text().
function router(o: RouterOpts = {}): typeof fetch {
  const {
    okMap = true,
    okProj = true,
    okCalc = true,
    okDp = true,
    okNfl = true,
  } = o;
  return (async (url: string) => {
    const u = String(url);
    if (u.includes("players/nfl")) return jsonResponse(playerMap, okMap);
    if (u.includes("projections")) return jsonResponse(projections, okProj);
    if (u.includes("fantasycalc")) return jsonResponse(fc, okCalc);
    if (u.includes("db_playerids")) return textResponse(dpCsv, okDp);
    if (u.includes("stats_player")) return textResponse(nflverseCsv, okNfl);
    return jsonResponse({}, false);
  }) as unknown as typeof fetch;
}

describe("handleSources", () => {
  it("joins all five feeds into one espn-id store", async () => {
    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      router(),
    );
    expect(out.meta.count).toBe(1);
    expect(out.meta.sources).toEqual([
      "sleeper",
      "fantasycalc",
      "dynastyprocess",
      "nflverse",
    ]);
    const entry = out.sources["4430807"];
    expect(entry.bio?.college).toBe("Texas");
    expect(entry.fantasycalc?.adp).toBe(1.6);
    expect(entry.sleeper?.proj.ppr).toBe(290);
    expect(entry.draft?.round).toBe(1);
    expect(entry.nflverse?.rushYards).toBe(1456);
    expect(entry.ids.gsis).toBe("G1");
  });

  it("drops only the feeds that fail (best-effort)", async () => {
    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      router({ okCalc: false, okNfl: false }),
    );
    expect(out.meta.sources).toEqual(["sleeper", "dynastyprocess"]);
    expect(out.sources["4430807"].sleeper?.proj.ppr).toBe(290);
    expect(out.sources["4430807"].fantasycalc).toBeUndefined();
    expect(out.sources["4430807"].nflverse).toBeUndefined();
    expect(out.sources["4430807"].draft?.round).toBe(1);
  });

  it("returns an empty store when every feed fails", async () => {
    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      router({
        okMap: false,
        okProj: false,
        okCalc: false,
        okDp: false,
        okNfl: false,
      }),
    );
    expect(out.meta.count).toBe(0);
    expect(out.meta.sources).toEqual([]);
  });
});

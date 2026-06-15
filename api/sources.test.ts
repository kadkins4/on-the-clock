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

// Route a fake URL to the right payload. The player map is /v1/players/nfl;
// projections are /projections/nfl/{year} — check the map first.
function router(
  map: unknown,
  proj: unknown,
  calc: unknown,
  okMap = true,
  okProj = true,
  okCalc = true,
): typeof fetch {
  return (async (url: string) => {
    const u = String(url);
    if (u.includes("players/nfl")) return jsonResponse(map, okMap);
    if (u.includes("projections")) return jsonResponse(proj, okProj);
    if (u.includes("fantasycalc")) return jsonResponse(calc, okCalc);
    return jsonResponse({}, false);
  }) as unknown as typeof fetch;
}

describe("handleSources", () => {
  it("joins the player map + projections + FantasyCalc into an espn-id store", async () => {
    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      router(playerMap, projections, fc),
    );
    expect(out.meta.count).toBe(1);
    expect(out.meta.sources).toEqual(["sleeper", "fantasycalc"]);
    const entry = out.sources["4430807"];
    expect(entry.bio?.college).toBe("Texas");
    expect(entry.fantasycalc?.adp).toBe(1.6);
    expect(entry.sleeper?.proj.ppr).toBe(290);
    expect(entry.sleeper?.stats.rush_yd).toBe(1400);
  });

  it("still covers a projection-only player when FantasyCalc fails", async () => {
    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      router(playerMap, projections, [], true, true, false),
    );
    // Sleeper still resolves via the player map even without FantasyCalc
    expect(out.meta.sources).toEqual(["sleeper"]);
    expect(out.sources["4430807"].sleeper?.proj.ppr).toBe(290);
    expect(out.sources["4430807"].fantasycalc).toBeUndefined();
  });

  it("returns an empty store when every feed fails", async () => {
    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      router(null, null, null, false, false, false),
    );
    expect(out.meta.count).toBe(0);
    expect(out.meta.sources).toEqual([]);
  });
});

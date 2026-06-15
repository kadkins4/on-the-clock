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

const sleeper = [
  {
    player_id: "9509",
    stats: { pts_ppr: 290, adp_ppr: 1.6, rush_yd: 1400 },
  },
];

describe("handleSources", () => {
  it("joins FantasyCalc + Sleeper into an espn-id-keyed store", async () => {
    const fakeFetch = (async (url: string) => {
      if (String(url).includes("fantasycalc")) return jsonResponse(fc);
      if (String(url).includes("sleeper")) return jsonResponse(sleeper);
      return jsonResponse({}, false);
    }) as unknown as typeof fetch;

    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      fakeFetch,
    );
    expect(out.meta.count).toBe(1);
    expect(out.meta.sources).toEqual(["fantasycalc", "sleeper"]);
    const entry = out.sources["4430807"];
    expect(entry.fantasycalc?.adp).toBe(1.6);
    expect(entry.sleeper?.proj.ppr).toBe(290);
    expect(entry.sleeper?.stats.rush_yd).toBe(1400);
  });

  it("degrades to FantasyCalc-only when Sleeper fails (best-effort)", async () => {
    const fakeFetch = (async (url: string) => {
      if (String(url).includes("fantasycalc")) return jsonResponse(fc);
      return jsonResponse({}, false); // sleeper all non-ok
    }) as unknown as typeof fetch;

    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      fakeFetch,
    );
    expect(out.meta.sources).toEqual(["fantasycalc"]);
    expect(out.sources["4430807"].sleeper).toBeUndefined();
  });

  it("returns an empty store when FantasyCalc (the crosswalk) fails", async () => {
    const fakeFetch = (async () =>
      jsonResponse({}, false)) as unknown as typeof fetch;
    const out = await handleSources(
      { season: 2026, teams: 12, ppr: 1 },
      fakeFetch,
    );
    expect(out.meta.count).toBe(0);
    expect(out.meta.sources).toEqual([]);
  });
});

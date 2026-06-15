import { describe, it, expect } from "vitest";
import { handleAdp } from "./adp";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => "",
  } as unknown as Response;
}

describe("handleAdp multi-source", () => {
  it("returns ffc, fantasypros and yahoo arrays", async () => {
    const fakeFetch = (async (url: string) => {
      if (String(url).includes("fantasyfootballcalculator")) {
        return jsonResponse({
          status: "Success",
          meta: { type: "PPR", total_drafts: 100 },
          players: [{ name: "AJ Brown", position: "WR", team: "PHI", adp: 20 }],
        });
      }
      if (String(url).includes("fantasypros")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            `<tr><td>1</td><td><a fp-player-name="AJ Brown">AJ Brown</a> <small>PHI</small></td><td>WR1</td><td>21</td></tr>`,
          json: async () => ({}),
        } as unknown as Response;
      }
      return jsonResponse({}, false); // yahoo creds absent in test env → skipped
    }) as unknown as typeof fetch;

    const out = await handleAdp(
      { scoring: "ppr", teams: 12, season: 2026 },
      fakeFetch,
      {},
    );
    expect(out.ffc.length).toBe(1);
    expect(out.fantasypros.length).toBe(1);
    expect(Array.isArray(out.yahoo)).toBe(true);
    expect(out.yahoo.length).toBe(0);
    expect(out.meta.sources).toContain("ffc");
    expect(out.meta.sources).toContain("fantasypros");
  });

  it("pages Yahoo past the first 25 until an empty page", async () => {
    const yahooPage = (count: number) => {
      const players: Record<string, unknown> = { count };
      for (let i = 0; i < count; i++) {
        players[String(i)] = {
          player: [
            [
              { name: { full: `Player ${i}` } },
              { display_position: "WR" },
              { editorial_team_abbr: "PHI" },
            ],
            { draft_analysis: [{ average_pick: "10.5" }] },
          ],
        };
      }
      return { fantasy_content: { game: [{}, { players }] } };
    };

    const fakeFetch = (async (url: string) => {
      const u = String(url);
      if (u.includes("fantasyfootballcalculator")) {
        return jsonResponse({
          status: "Success",
          meta: { type: "PPR" },
          players: [{ name: "AJ Brown", position: "WR", team: "PHI", adp: 20 }],
        });
      }
      if (u.includes("get_token")) {
        return jsonResponse({ access_token: "tok" });
      }
      if (u.includes("draft_analysis")) {
        if (u.includes("start=0;")) return jsonResponse(yahooPage(25));
        if (u.includes("start=25;")) return jsonResponse(yahooPage(25));
        return jsonResponse(yahooPage(0)); // start=50 → empty → stop
      }
      return jsonResponse({}, false); // fantasypros absent
    }) as unknown as typeof fetch;

    const out = await handleAdp(
      { scoring: "ppr", teams: 12, season: 2026 },
      fakeFetch,
      {
        YAHOO_CLIENT_ID: "id",
        YAHOO_CLIENT_SECRET: "secret",
        YAHOO_REFRESH_TOKEN: "refresh",
      },
    );

    expect(out.yahoo.length).toBe(50); // two full pages, not just 25
    expect(out.meta.sources).toContain("yahoo");
  });
});

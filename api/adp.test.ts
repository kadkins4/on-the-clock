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
});

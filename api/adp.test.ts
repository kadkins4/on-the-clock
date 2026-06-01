import { describe, it, expect, vi } from "vitest";
import { handleAdp } from "./adp";

const ok = (players: unknown[], meta: object = {}) =>
  ({
    ok: true,
    json: async () => ({ status: "Success", players, meta }),
  }) as Response;
const noData = () =>
  ({
    ok: true,
    json: async () => ({ status: "Error", errors: "No ADP data found." }),
  }) as Response;

describe("handleAdp", () => {
  it("requests the FFC format for the scoring + teams and normalizes", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL) =>
      ok([{ name: "CMC", position: "RB", team: "SF", adp: 1.4 }], {
        type: "PPR",
        total_drafts: 100,
      }),
    );
    const res = await handleAdp(
      { scoring: "ppr", teams: 12, season: 2026 },
      fetchImpl,
    );
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/adp/ppr?teams=12&year=2026");
    expect(res.players).toEqual([
      { name: "CMC", position: "RB", team: "SF", adp: 1.4 },
    ]);
    expect(res.meta.year).toBe(2026);
  });

  it("falls back to an earlier season when the requested one has no data", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(noData()) // 2026
      .mockResolvedValueOnce(
        ok([{ name: "CMC", position: "RB", team: "SF", adp: 1.4 }], {
          type: "PPR",
        }),
      ); // 2025
    const res = await handleAdp(
      { scoring: "ppr", teams: 12, season: 2026 },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res.meta.year).toBe(2025);
    expect(res.players).toHaveLength(1);
  });

  it("maps half scoring to the half-ppr slug", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL) =>
      ok([{ name: "CMC", position: "RB", team: "SF", adp: 1.4 }]),
    );
    await handleAdp({ scoring: "half", teams: 10, season: 2026 }, fetchImpl);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      "/adp/half-ppr?teams=10&year=2026",
    );
  });

  it("throws when no season has data within the fallback window", async () => {
    const fetchImpl = vi.fn(async () => noData());
    await expect(
      handleAdp({ scoring: "ppr", teams: 12, season: 2026 }, fetchImpl),
    ).rejects.toThrow(/no ADP/i);
  });
});

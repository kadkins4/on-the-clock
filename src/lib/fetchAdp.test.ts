import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAdp } from "./fetchAdp";

afterEach(() => vi.restoreAllMocks());

describe("fetchAdp", () => {
  it("calls /api/adp with scoring + teams and returns players + meta", async () => {
    const players = [{ name: "CMC", position: "RB", team: "SF", adp: 1.4 }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ players, meta: { year: 2025, type: "PPR" } }),
      })),
    );
    const res = await fetchAdp("ppr", 12);
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe("/api/adp?scoring=ppr&teams=12");
    expect(res.players).toEqual(players);
    expect(res.meta.year).toBe(2025);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: "no ADP" }),
      })),
    );
    await expect(fetchAdp("ppr", 12)).rejects.toThrow(/ADP/i);
  });
});

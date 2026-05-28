import { describe, it, expect, beforeEach } from "vitest";
import { savePlayers, loadPlayers, exportJson, importJson } from "./storage";
import { withByeWeeks } from "./byes";
import seed from "../data/seed.json";
import type { Player } from "../types";

const players: Player[] = [
  {
    id: "1",
    name: "A",
    position: "RB",
    team: "ATL",
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  },
];

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("saves and loads players", () => {
    savePlayers(players);
    expect(loadPlayers()).toEqual(withByeWeeks(players));
  });

  it("falls back to an ADP-ordered seed when nothing is stored", () => {
    const out = loadPlayers();
    expect(out.length).toBe((seed as unknown as Player[]).length);
    // contiguous 1-based ranks
    expect(out.map((p) => p.overallRank)).toEqual(out.map((_, i) => i + 1));
    // ordered by ADP ascending, with null ADPs last
    const adps = out.map((p) => p.adp);
    const nullStart = adps.findIndex((a) => a == null);
    const ranked = nullStart === -1 ? adps : adps.slice(0, nullStart);
    expect(ranked.every((a) => a != null)).toBe(true);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!).toBeGreaterThanOrEqual(ranked[i - 1]!);
    }
  });

  it("round-trips JSON export/import", () => {
    expect(importJson(exportJson(players))).toEqual(players);
  });

  it("throws on non-array JSON import", () => {
    expect(() => importJson('{"foo":1}')).toThrow();
  });
});

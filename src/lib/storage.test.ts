import { describe, it, expect, beforeEach } from "vitest";
import { savePlayers, loadPlayers, exportJson, importJson } from "./storage";
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
    drafted: false,
  },
];

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("saves and loads players", () => {
    savePlayers(players);
    expect(loadPlayers()).toEqual(players);
  });

  it("falls back to the seed when nothing is stored", () => {
    expect(loadPlayers()).toEqual(seed);
  });

  it("round-trips JSON export/import", () => {
    expect(importJson(exportJson(players))).toEqual(players);
  });

  it("throws on non-array JSON import", () => {
    expect(() => importJson('{"foo":1}')).toThrow();
  });
});

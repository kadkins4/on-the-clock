import { describe, it, expect, beforeEach } from "vitest";
import { saveBoard, loadBoard, exportJson, importJson } from "./storage";
import seed from "../data/seed.json";
import type { Player } from "../types";
import type { Board } from "../state/reducer";

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

const OLD_KEY = "ff-cheat-sheet:players:v2";

beforeEach(() => localStorage.clear());

describe("storage (board)", () => {
  it("saves and loads a named-list board", () => {
    const board: Board = { current: "PPR", lists: { PPR: players } };
    saveBoard(board);
    const out = loadBoard();
    expect(out.current).toBe("PPR");
    expect(out.lists.PPR[0].id).toBe("1");
  });

  it("falls back to a single ADP-ordered list when nothing is stored", () => {
    const out = loadBoard();
    expect(Object.keys(out.lists)).toHaveLength(1);
    const list = out.lists[out.current];
    expect(list.length).toBe((seed as unknown as Player[]).length);
    expect(list.map((p) => p.overallRank)).toEqual(list.map((_, i) => i + 1));
    const adps = list.map((p) => p.adp);
    const nullStart = adps.findIndex((a) => a == null);
    const ranked = nullStart === -1 ? adps : adps.slice(0, nullStart);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!).toBeGreaterThanOrEqual(ranked[i - 1]!);
    }
  });

  it("migrates an old single-board (v2) into a named list", () => {
    localStorage.setItem(OLD_KEY, JSON.stringify(players));
    const out = loadBoard();
    expect(Object.keys(out.lists)).toHaveLength(1);
    expect(out.lists[out.current][0].id).toBe("1");
  });

  it("round-trips JSON export/import", () => {
    expect(importJson(exportJson(players))).toEqual(players);
  });

  it("throws on non-array JSON import", () => {
    expect(() => importJson('{"foo":1}')).toThrow();
  });
});

import { loadLeagues, saveLeagues } from "./storage";
import type { LeaguesState } from "../types";

const LISTS_KEY = "ff-cheat-sheet:lists:v1";
const LEAGUES_KEY = "ff-cheat-sheet:leagues:v1";

describe("league storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a saved LeaguesState", () => {
    saveLeagues({ currentId: "x", leagues: [] } as unknown as LeaguesState);
    expect(localStorage.getItem(LEAGUES_KEY)).toContain('"currentId":"x"');
  });

  it("migrates a named-lists board when no leagues key exists", () => {
    localStorage.setItem(
      LISTS_KEY,
      JSON.stringify({ current: "PPR", lists: { PPR: [], Dynasty: [] } }),
    );
    const state = loadLeagues();
    expect(state.leagues.map((l) => l.name)).toEqual(["PPR", "Dynasty"]);
    const current = state.leagues.find((l) => l.id === state.currentId);
    expect(current?.name).toBe("PPR");
  });

  it("seeds a single league when storage is empty", () => {
    const state = loadLeagues();
    expect(state.leagues).toHaveLength(1);
    expect(state.leagues[0].board.length).toBeGreaterThan(0);
  });

  it("prefers an existing leagues key over older shapes", () => {
    const saved: LeaguesState = {
      currentId: "keep",
      leagues: [
        {
          id: "keep",
          name: "Saved",
          platform: "other",
          scoring: "ppr",
          tePremium: false,
          teams: 12,
          roster: {
            QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0,
            K: 1, DST: 1, bench: 6, disabled: [],
          },
          board: [],
          updatedAt: 1,
        },
      ],
    };
    localStorage.setItem(LEAGUES_KEY, JSON.stringify(saved));
    localStorage.setItem(
      LISTS_KEY,
      JSON.stringify({ current: "PPR", lists: { PPR: [] } }),
    );
    expect(loadLeagues().leagues[0].name).toBe("Saved");
  });
});

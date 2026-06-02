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

import { loadLeagues, saveLeagues, migrateLeaguesV1toV2 } from "./storage";
import { activeBoard, makeLeague } from "./league";
import type { League, LeaguesState } from "../types";

const LISTS_KEY = "ff-cheat-sheet:lists:v1";
const LEAGUES_KEY_V1 = "ff-cheat-sheet:leagues:v1";
const LEAGUES_KEY_V2 = "ff-cheat-sheet:leagues:v2";

// a v1-shaped league (single `board`, no tier lists)
function v1League(id: string, name: string, board: Player[] = []): League {
  return {
    id,
    name,
    platform: "other",
    scoring: "ppr",
    tePremium: false,
    teams: 12,
    roster: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      SUPERFLEX: 0,
      K: 1,
      DST: 1,
      bench: 6,
      disabled: [],
    },
    board,
    updatedAt: 1,
  } as unknown as League;
}

describe("league storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a saved LeaguesState through the v2 key", () => {
    saveLeagues({ currentId: "x", leagues: [] } as unknown as LeaguesState);
    expect(localStorage.getItem(LEAGUES_KEY_V2)).toContain('"currentId":"x"');
  });

  it("migrateLeaguesV1toV2 wraps each board as a Default tier list", () => {
    const state: LeaguesState = {
      currentId: "a",
      leagues: [v1League("a", "A", players), v1League("b", "B")],
    };
    const v2 = migrateLeaguesV1toV2(state);
    expect(v2.currentId).toBe("a");
    expect(v2.leagues).toHaveLength(2);
    const first = v2.leagues[0];
    expect(first.tierLists).toHaveLength(1);
    expect(first.tierLists[0].name).toBe("Default");
    expect(first.tierLists[0].board).toEqual(players);
    expect(first.activeTierListId).toBe(first.tierLists[0].id);
    expect(first.defaultTierListId).toBe(first.tierLists[0].id);
    expect("board" in first).toBe(false); // old field dropped
  });

  it("migrateLeaguesV1toV2 is idempotent on v2 leagues", () => {
    const lg = makeLeague({ name: "Already", board: players });
    const state: LeaguesState = { currentId: lg.id, leagues: [lg] };
    expect(migrateLeaguesV1toV2(state)).toEqual(state);
  });

  it("migrates a v1 leagues key to v2 on load", () => {
    localStorage.setItem(
      LEAGUES_KEY_V1,
      JSON.stringify({
        currentId: "a",
        leagues: [v1League("a", "Legacy", players)],
      }),
    );
    const state = loadLeagues();
    expect(state.leagues[0].name).toBe("Legacy");
    expect(activeBoard(state.leagues[0])[0].id).toBe("1");
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
    expect(activeBoard(state.leagues[0]).length).toBeGreaterThan(0);
  });

  it("prefers an existing leagues key over older shapes", () => {
    const saved: LeaguesState = {
      currentId: "keep",
      leagues: [v1League("keep", "Saved")],
    };
    localStorage.setItem(LEAGUES_KEY_V1, JSON.stringify(saved));
    localStorage.setItem(
      LISTS_KEY,
      JSON.stringify({ current: "PPR", lists: { PPR: [] } }),
    );
    expect(loadLeagues().leagues[0].name).toBe("Saved");
  });

  it("prefers v2 over a v1 leagues key", () => {
    localStorage.setItem(
      LEAGUES_KEY_V2,
      JSON.stringify({
        currentId: "v2",
        leagues: [makeLeague({ name: "V2 league", board: players })],
      }),
    );
    localStorage.setItem(
      LEAGUES_KEY_V1,
      JSON.stringify({
        currentId: "v1",
        leagues: [v1League("v1", "V1 league")],
      }),
    );
    expect(loadLeagues().leagues[0].name).toBe("V2 league");
  });
});

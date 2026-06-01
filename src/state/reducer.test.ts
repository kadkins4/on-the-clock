import { describe, it, expect } from "vitest";
import { rankingReducer, boardReducer, type Board } from "./reducer";
import type { Player } from "../types";

function mk(id: string, over: number, tier: number | null = 1): Player {
  return {
    id,
    name: id,
    position: "RB",
    team: "FA",
    overallRank: over,
    byeWeek: null,
    tier,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

describe("rankingReducer", () => {
  const base = [mk("a", 1), mk("b", 2), mk("c", 3)];

  it("setAll sorts by rank and reassigns 1-based ranks", () => {
    const out = rankingReducer([], {
      type: "setAll",
      players: [mk("x", 5), mk("y", 1)],
    });
    expect(out.map((p) => p.id)).toEqual(["y", "x"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
  });

  it("add appends and reassigns ranks", () => {
    const out = rankingReducer(base, { type: "add", player: mk("d", 0) });
    expect(out).toHaveLength(4);
    expect(out[3]).toMatchObject({ id: "d", overallRank: 4 });
  });

  it("update patches a single player", () => {
    const out = rankingReducer(base, {
      type: "update",
      id: "b",
      patch: { notes: "hi" },
    });
    expect(out.find((p) => p.id === "b")!.notes).toBe("hi");
  });

  it("remove drops the player and reassigns ranks", () => {
    const out = rankingReducer(base, { type: "remove", id: "a" });
    expect(out.map((p) => p.id)).toEqual(["b", "c"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
  });

  it("update can set draftStatus", () => {
    const out = rankingReducer(base, {
      type: "update",
      id: "a",
      patch: { draftStatus: "mine" },
    });
    expect(out.find((p) => p.id === "a")!.draftStatus).toBe("mine");
  });

  it("move reorders and reassigns ranks", () => {
    const out = rankingReducer(base, {
      type: "move",
      activeId: "c",
      overId: "a",
    });
    expect(out.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
  });
});

describe("boardReducer", () => {
  const board = (): Board => ({
    current: "PPR",
    lists: { PPR: [mk("a", 1)], Dynasty: [mk("z", 1)] },
  });

  it("applies player actions only to the current list", () => {
    const out = boardReducer(board(), {
      type: "update",
      id: "a",
      patch: { notes: "hi" },
    });
    expect(out.lists.PPR[0].notes).toBe("hi");
    expect(out.lists.Dynasty[0].notes).toBe(""); // untouched
    expect(out.current).toBe("PPR");
  });

  it("switchList changes the active list", () => {
    const out = boardReducer(board(), { type: "switchList", name: "Dynasty" });
    expect(out.current).toBe("Dynasty");
    expect(out.lists.PPR).toBeDefined(); // both still exist
  });

  it("saveListAs copies the current list under a new name and selects it", () => {
    const out = boardReducer(board(), { type: "saveListAs", name: "PPR copy" });
    expect(out.current).toBe("PPR copy");
    expect(out.lists["PPR copy"].map((p) => p.id)).toEqual(["a"]);
    expect(out.lists.PPR).toBeDefined(); // original kept
  });

  it("deleteList removes a list and picks another current", () => {
    const out = boardReducer(board(), { type: "deleteList", name: "PPR" });
    expect(out.lists.PPR).toBeUndefined();
    expect(out.current).toBe("Dynasty");
  });

  it("deleteList is a no-op when only one list remains", () => {
    const single: Board = { current: "PPR", lists: { PPR: [mk("a", 1)] } };
    const out = boardReducer(single, { type: "deleteList", name: "PPR" });
    expect(Object.keys(out.lists)).toEqual(["PPR"]);
  });

  it("renameList renames the current list, refusing duplicates", () => {
    const out = boardReducer(board(), { type: "renameList", name: "Redraft" });
    expect(out.current).toBe("Redraft");
    expect(out.lists.Redraft).toBeDefined();
    expect(out.lists.PPR).toBeUndefined();
    // duplicate name is rejected
    const dup = boardReducer(board(), { type: "renameList", name: "Dynasty" });
    expect(dup).toEqual(board());
  });
});

import { leaguesReducer } from "./reducer";
import { makeLeague, defaultRoster } from "../lib/league";
import type { LeaguesState } from "../types";

const mkPlayer = (id: string, rank: number): Player => ({
  id,
  name: `P${id}`,
  position: "RB",
  team: "ATL",
  overallRank: rank,
  byeWeek: null,
  tier: 1,
  adp: rank,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

function twoLeagues(): LeaguesState {
  const a = makeLeague({ name: "Money", board: [mkPlayer("1", 1)] });
  const b = makeLeague({ name: "Dynasty", board: [mkPlayer("2", 1)] });
  return { currentId: a.id, leagues: [a, b] };
}

describe("leaguesReducer — league actions", () => {
  it("switchLeague changes currentId", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, {
      type: "switchLeague",
      id: s.leagues[1].id,
    });
    expect(next.currentId).toBe(s.leagues[1].id);
  });

  it("switchLeague ignores unknown ids", () => {
    const s = twoLeagues();
    expect(leaguesReducer(s, { type: "switchLeague", id: "nope" })).toBe(s);
  });

  it("addLeague appends an empty-board league and makes it current", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, { type: "addLeague", name: "Best Ball" });
    expect(next.leagues).toHaveLength(3);
    expect(next.leagues[2].name).toBe("Best Ball");
    expect(next.leagues[2].roster).toEqual(defaultRoster());
    expect(next.currentId).toBe(next.leagues[2].id);
  });

  it("addLeague ignores blank names", () => {
    const s = twoLeagues();
    expect(leaguesReducer(s, { type: "addLeague", name: "  " })).toBe(s);
  });

  it("renameLeague renames the targeted league", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, {
      type: "renameLeague",
      id: s.leagues[0].id,
      name: "Big Money",
    });
    expect(next.leagues[0].name).toBe("Big Money");
  });

  it("deleteLeague removes it and repoints current when needed", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, { type: "deleteLeague", id: s.currentId });
    expect(next.leagues).toHaveLength(1);
    expect(next.leagues[0].name).toBe("Dynasty");
    expect(next.currentId).toBe(next.leagues[0].id);
  });

  it("deleteLeague refuses to remove the last league", () => {
    const a = makeLeague({ name: "Solo", board: [] });
    const s: LeaguesState = { currentId: a.id, leagues: [a] };
    expect(leaguesReducer(s, { type: "deleteLeague", id: a.id })).toBe(s);
  });

  it("updateLeagueSettings patches scoring/teams/roster", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, {
      type: "updateLeagueSettings",
      id: s.leagues[0].id,
      patch: { scoring: "half", teams: 14, tePremium: true },
    });
    expect(next.leagues[0].scoring).toBe("half");
    expect(next.leagues[0].teams).toBe(14);
    expect(next.leagues[0].tePremium).toBe(true);
  });
});

describe("leaguesReducer — delegated player actions", () => {
  it("routes 'update' to the active league's board only", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, {
      type: "update",
      id: "1",
      patch: { notes: "stud" },
    });
    expect(next.leagues[0].board[0].notes).toBe("stud");
    expect(next.leagues[1].board[0].notes).toBe("");
  });

  it("bumps updatedAt on the active league when its board changes", () => {
    const s = twoLeagues();
    s.leagues[0].updatedAt = 1;
    const next = leaguesReducer(s, {
      type: "update",
      id: "1",
      patch: { notes: "x" },
    });
    expect(next.leagues[0].updatedAt).toBeGreaterThan(1);
  });
});

import { teamMeta } from "../data/teamMeta";

describe("leaguesReducer — review fixes (M1/L4/M2)", () => {
  it("M1: switchLeague normalizes the target league's board (byes + tiers)", () => {
    const a = makeLeague({ name: "A", board: [mkPlayer("1", 1)] });
    const raw = makeLeague({
      name: "B",
      board: [{ ...mkPlayer("9", 1), tier: null, byeWeek: null, team: "ATL" }],
    });
    const s: LeaguesState = { currentId: a.id, leagues: [a, raw] };
    const next = leaguesReducer(s, { type: "switchLeague", id: raw.id });
    const b = next.leagues.find((l) => l.id === raw.id)!;
    expect(b.board[0].tier).toBe(1); // null tier filled
    expect(b.board[0].byeWeek).toBe(teamMeta["ATL"].byeWeek); // bye enriched
  });

  it("L4: a no-op delegated action returns the same state (no updatedAt bump)", () => {
    const s = twoLeagues();
    // moveAndRetier with activeId === overId is a no-op (same board ref)
    const next = leaguesReducer(s, {
      type: "move",
      activeId: "1",
      overId: "1",
    });
    expect(next).toBe(s);
  });

  it("M2: duplicateLeague clones board + settings into a new current league", () => {
    const s = twoLeagues();
    const src = leaguesReducer(s, {
      type: "updateLeagueSettings",
      id: s.leagues[0].id,
      patch: { scoring: "half", teams: 14, tePremium: true },
    });
    const next = leaguesReducer(src, {
      type: "duplicateLeague",
      id: src.leagues[0].id,
      name: "Clone",
    });
    expect(next.leagues).toHaveLength(3);
    const dup = next.leagues[2];
    expect(dup.name).toBe("Clone");
    expect(next.currentId).toBe(dup.id);
    expect(dup.scoring).toBe("half");
    expect(dup.teams).toBe(14);
    expect(dup.tePremium).toBe(true);
    // board is a copy: equal contents, different array + element refs
    expect(dup.board).toEqual(src.leagues[0].board);
    expect(dup.board).not.toBe(src.leagues[0].board);
    expect(dup.board[0]).not.toBe(src.leagues[0].board[0]);
    expect(dup.id).not.toBe(src.leagues[0].id);
  });

  it("M2: duplicateLeague ignores blank names and unknown ids", () => {
    const s = twoLeagues();
    expect(
      leaguesReducer(s, {
        type: "duplicateLeague",
        id: s.leagues[0].id,
        name: " ",
      }),
    ).toBe(s);
    expect(
      leaguesReducer(s, { type: "duplicateLeague", id: "nope", name: "X" }),
    ).toBe(s);
  });
});

describe("leaguesReducer — applyAdp", () => {
  it("blends FFC adp into the active league's board, preserving order", () => {
    const p: Player = {
      id: "1",
      name: "A.J. Brown",
      position: "WR",
      team: "PHI",
      overallRank: 1,
      byeWeek: null,
      tier: 1,
      adp: 10,
      adpSources: { espn: 10 },
      notes: "",
      flag: "none",
      draftStatus: "available",
    };
    const lg = makeLeague({ name: "Test", board: [p] });
    const base: LeaguesState = { currentId: lg.id, leagues: [lg] };
    const next = leaguesReducer(base, {
      type: "applyAdp",
      ffc: [{ name: "AJ Brown", position: "WR", team: "PHI", adp: 20 }],
    });
    const updated = next.leagues[0].board[0];
    expect(updated.adpSources).toEqual({ espn: 10, ffc: 20 });
    expect(updated.adp).toBe(15);
    expect(updated.id).toBe("1");
  });
});

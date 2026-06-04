import { describe, it, expect } from "vitest";
import { boardReducer } from "./reducer";
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

describe("boardReducer", () => {
  const base = [mk("a", 1), mk("b", 2), mk("c", 3)];

  it("setAll sorts by rank and reassigns 1-based ranks", () => {
    const out = boardReducer(
      { players: [], breaks: [] },
      { type: "setAll", players: [mk("x", 5), mk("y", 1)] },
    ).players;
    expect(out.map((p) => p.id)).toEqual(["y", "x"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
  });

  it("add appends and reassigns ranks", () => {
    const out = boardReducer(
      { players: base, breaks: [] },
      { type: "add", player: mk("d", 0) },
    ).players;
    expect(out).toHaveLength(4);
    expect(out[3]).toMatchObject({ id: "d", overallRank: 4 });
  });

  it("update patches a single player", () => {
    const out = boardReducer(
      { players: base, breaks: [] },
      { type: "update", id: "b", patch: { notes: "hi" } },
    ).players;
    expect(out.find((p) => p.id === "b")!.notes).toBe("hi");
  });

  it("remove drops the player and reassigns ranks", () => {
    const out = boardReducer(
      { players: base, breaks: [] },
      { type: "remove", id: "a" },
    ).players;
    expect(out.map((p) => p.id)).toEqual(["b", "c"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
  });

  it("remove shifts breaks below the removed player up by one", () => {
    const out = boardReducer(
      { players: base, breaks: [{ id: "br1", above: 2 }] },
      { type: "remove", id: "a" },
    );
    // break sat above index 2 (before "c"); removing "a" (index 0) shifts it to 1
    expect(out.players.map((p) => p.id)).toEqual(["b", "c"]);
    expect(out.breaks).toEqual([{ id: "br1", above: 1 }]);
  });

  it("update can set draftStatus", () => {
    const out = boardReducer(
      { players: base, breaks: [] },
      { type: "update", id: "a", patch: { draftStatus: "mine" } },
    ).players;
    expect(out.find((p) => p.id === "a")!.draftStatus).toBe("mine");
  });

  it("move reorders and reassigns ranks", () => {
    const out = boardReducer(
      { players: base, breaks: [] },
      { type: "move", activeId: "c", overId: "a" },
    ).players;
    expect(out.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
  });
});

import { leaguesReducer } from "./reducer";
import {
  makeLeague,
  defaultRoster,
  activeBoard,
  activeTierList,
} from "../lib/league";
import type { LeaguesState } from "../types";
import type { ColumnLayout } from "../lib/columnLayout";

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

  it("setLeagues replaces the whole state (refresh from source)", () => {
    const s = twoLeagues();
    const fresh: LeaguesState = {
      currentId: s.leagues[1].id,
      leagues: [s.leagues[1]],
    };
    expect(leaguesReducer(s, { type: "setLeagues", state: fresh })).toBe(fresh);
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

  it("setLeagueColumns sets then clears the per-league override", () => {
    const s = twoLeagues();
    const id = s.leagues[0].id;
    const layout: ColumnLayout = { order: [], hidden: ["vor"] };
    const set = leaguesReducer(s, { type: "setLeagueColumns", id, layout });
    expect(set.leagues[0].columnsOverride).toEqual(layout);
    expect(set.leagues[1].columnsOverride ?? null).toBeNull(); // other untouched
    const cleared = leaguesReducer(set, {
      type: "setLeagueColumns",
      id,
      layout: null,
    });
    expect(cleared.leagues[0].columnsOverride).toBeNull();
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
    expect(activeBoard(next.leagues[0])[0].notes).toBe("stud");
    expect(activeBoard(next.leagues[1])[0].notes).toBe("");
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
    expect(activeBoard(b)[0].tier).toBe(1); // null tier filled
    expect(activeBoard(b)[0].byeWeek).toBe(teamMeta["ATL"].byeWeek); // bye enriched
  });

  it("L4: a no-op delegated action returns the same state (no updatedAt bump)", () => {
    const s = twoLeagues();
    // applyDrag with activeId === overId returns the same refs (no-op)
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
    const dupBoard = activeBoard(dup);
    const srcBoard = activeBoard(src.leagues[0]);
    expect(dupBoard).toEqual(srcBoard);
    expect(dupBoard).not.toBe(srcBoard);
    expect(dupBoard[0]).not.toBe(srcBoard[0]);
    expect(dup.id).not.toBe(src.leagues[0].id);
    // tier lists are cloned with fresh ids
    expect(dup.tierLists[0].id).not.toBe(src.leagues[0].tierLists[0].id);
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
    const updated = activeBoard(next.leagues[0])[0];
    expect(updated.adpSources).toEqual({ espn: 10, ffc: 20 });
    expect(updated.adp).toBe(15);
    expect(updated.id).toBe("1");
  });
});

describe("leaguesReducer — tier-list actions", () => {
  // a single league with two named tier lists, the first active + default
  function withTierLists(): LeaguesState {
    const lg = makeLeague({ name: "L", board: [mkPlayer("a", 1)] });
    const second = {
      id: "list-2",
      name: "RB-heavy",
      board: [mkPlayer("b", 1)],
    };
    const withTwo = { ...lg, tierLists: [...lg.tierLists, second] };
    return { currentId: lg.id, leagues: [withTwo] };
  }

  it("switchTierList changes the active list and normalizes its board", () => {
    const s = withTierLists();
    const next = leaguesReducer(s, { type: "switchTierList", id: "list-2" });
    const lg = next.leagues[0];
    expect(lg.activeTierListId).toBe("list-2");
    expect(activeTierList(lg).name).toBe("RB-heavy");
    expect(activeBoard(lg)[0].tier).toBe(1); // normalized
  });

  it("switchTierList ignores unknown ids", () => {
    const s = withTierLists();
    expect(leaguesReducer(s, { type: "switchTierList", id: "nope" })).toBe(s);
  });

  it("addTierList appends a seeded list and makes it active", () => {
    const s = withTierLists();
    const next = leaguesReducer(s, { type: "addTierList", name: "Sleepers" });
    const lg = next.leagues[0];
    expect(lg.tierLists).toHaveLength(3);
    expect(lg.tierLists[2].name).toBe("Sleepers");
    expect(lg.activeTierListId).toBe(lg.tierLists[2].id);
    expect(activeBoard(lg).length).toBeGreaterThan(0); // seeded from ADP
  });

  it("addTierList ignores blank names", () => {
    const s = withTierLists();
    expect(leaguesReducer(s, { type: "addTierList", name: " " })).toBe(s);
  });

  it("duplicateTierList copies the active board into an independent list", () => {
    const s = withTierLists();
    const next = leaguesReducer(s, {
      type: "duplicateTierList",
      name: "L copy",
    });
    const lg = next.leagues[0];
    expect(lg.tierLists).toHaveLength(3);
    expect(lg.activeTierListId).toBe(lg.tierLists[2].id);
    expect(activeBoard(lg)).toEqual([mkPlayer("a", 1)]);
    // editing the copy must not touch the original
    const edited = leaguesReducer(next, {
      type: "update",
      id: "a",
      patch: { notes: "copy-only" },
    });
    expect(activeBoard(edited.leagues[0])[0].notes).toBe("copy-only");
    expect(edited.leagues[0].tierLists[0].board[0].notes).toBe("");
  });

  it("renameTierList renames the active list", () => {
    const s = withTierLists();
    const next = leaguesReducer(s, {
      type: "renameTierList",
      name: "Balanced",
    });
    expect(next.leagues[0].tierLists[0].name).toBe("Balanced");
    expect(leaguesReducer(s, { type: "renameTierList", name: " " })).toBe(s);
  });

  it("deleteTierList removes by id and reassigns active/default", () => {
    const s = withTierLists(); // active+default = list-1
    const list1 = s.leagues[0].tierLists[0].id;
    const next = leaguesReducer(s, { type: "deleteTierList", id: list1 });
    const lg = next.leagues[0];
    expect(lg.tierLists.map((t) => t.id)).toEqual(["list-2"]);
    expect(lg.activeTierListId).toBe("list-2");
    expect(lg.defaultTierListId).toBe("list-2");
  });

  it("deleteTierList refuses to remove the last list", () => {
    const lg = makeLeague({ name: "Solo", board: [mkPlayer("a", 1)] });
    const s: LeaguesState = { currentId: lg.id, leagues: [lg] };
    expect(
      leaguesReducer(s, {
        type: "deleteTierList",
        id: lg.tierLists[0].id,
      }),
    ).toBe(s);
  });

  it("setDefaultTierList marks a list default; ignores unknown ids", () => {
    const s = withTierLists();
    const next = leaguesReducer(s, {
      type: "setDefaultTierList",
      id: "list-2",
    });
    expect(next.leagues[0].defaultTierListId).toBe("list-2");
    expect(leaguesReducer(s, { type: "setDefaultTierList", id: "x" })).toBe(s);
  });

  it("player actions target only the active tier list", () => {
    const s = withTierLists(); // active = list-1
    const next = leaguesReducer(s, {
      type: "update",
      id: "a",
      patch: { notes: "active-only" },
    });
    const lg = next.leagues[0];
    expect(lg.tierLists[0].board[0].notes).toBe("active-only");
    expect(lg.tierLists[1].board[0].notes).toBe(""); // other list untouched
  });
});

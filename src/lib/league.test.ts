import { describe, it, expect } from "vitest";
import {
  defaultRoster,
  makeLeague,
  migrateBoardToLeagues,
  activeTierList,
  activeBoard,
  defaultBoard,
} from "./league";
import type { Board } from "../state/reducer";
import type { League, Player } from "../types";

const player = (id: string): Player => ({
  id,
  name: `P${id}`,
  position: "RB",
  team: "ATL",
  overallRank: 1,
  byeWeek: null,
  tier: 1,
  adp: 1,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

describe("defaultRoster", () => {
  it("returns the standard 1QB/2RB/2WR/1TE/1FLEX league shape", () => {
    expect(defaultRoster()).toEqual({
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
    });
  });

  it("returns a fresh object each call (no shared mutation)", () => {
    const a = defaultRoster();
    a.disabled.push("K");
    expect(defaultRoster().disabled).toEqual([]);
  });
});

describe("makeLeague", () => {
  it("builds a league with defaults and the given name + board", () => {
    const board = [player("1")];
    const lg = makeLeague({ name: "Money", board });
    expect(lg.name).toBe("Money");
    expect(lg.tierLists).toHaveLength(1);
    expect(lg.tierLists[0].name).toBe("Default");
    expect(lg.tierLists[0].board).toBe(board);
    expect(lg.activeTierListId).toBe(lg.tierLists[0].id);
    expect(lg.defaultTierListId).toBe(lg.tierLists[0].id);
    expect(lg.scoring).toBe("ppr");
    expect(lg.platform).toBe("other");
    expect(lg.teams).toBe(12);
    expect(lg.tePremium).toBe(false);
    expect(lg.roster).toEqual(defaultRoster());
    expect(typeof lg.id).toBe("string");
    expect(lg.id.length).toBeGreaterThan(0);
    expect(typeof lg.updatedAt).toBe("number");
  });

  it("honors overrides and defaults the board to empty", () => {
    const lg = makeLeague({
      name: "Dynasty",
      scoring: "half",
      teams: 10,
      platform: "sleeper",
    });
    expect(lg.scoring).toBe("half");
    expect(lg.teams).toBe(10);
    expect(lg.platform).toBe("sleeper");
    expect(lg.tierLists[0].board).toEqual([]);
  });

  it("gives distinct ids to distinct leagues", () => {
    expect(makeLeague({ name: "A" }).id).not.toBe(makeLeague({ name: "B" }).id);
  });
});

describe("migrateBoardToLeagues", () => {
  it("creates one league per named list, preserving boards", () => {
    const board: Board = {
      current: "Dynasty",
      lists: { PPR: [player("1")], Dynasty: [player("2")] },
    };
    const state = migrateBoardToLeagues(board);
    expect(state.leagues.map((l) => l.name)).toEqual(["PPR", "Dynasty"]);
    expect(activeBoard(state.leagues[0])).toEqual([player("1")]);
    expect(activeBoard(state.leagues[1])).toEqual([player("2")]);
  });

  it("sets currentId to the league matching board.current", () => {
    const board: Board = {
      current: "Dynasty",
      lists: { PPR: [player("1")], Dynasty: [player("2")] },
    };
    const state = migrateBoardToLeagues(board);
    const current = state.leagues.find((l) => l.id === state.currentId);
    expect(current?.name).toBe("Dynasty");
  });

  it("falls back to the first league when current name is missing", () => {
    const board: Board = { current: "Ghost", lists: { PPR: [player("1")] } };
    const state = migrateBoardToLeagues(board);
    expect(state.currentId).toBe(state.leagues[0].id);
  });
});

describe("tier-list accessors", () => {
  const twoLists = (): League => {
    const lg = makeLeague({ name: "L", board: [player("a")] });
    const second = { id: "list-2", name: "RB-heavy", board: [player("b")] };
    return { ...lg, tierLists: [...lg.tierLists, second] };
  };

  it("activeTierList returns the list matching activeTierListId", () => {
    const lg = { ...twoLists(), activeTierListId: "list-2" };
    expect(activeTierList(lg).name).toBe("RB-heavy");
    expect(activeBoard(lg)).toEqual([player("b")]);
  });

  it("defaultBoard returns the list matching defaultTierListId", () => {
    const base = twoLists();
    const lg = { ...base, defaultTierListId: base.tierLists[0].id };
    expect(defaultBoard(lg)).toEqual([player("a")]);
  });

  it("falls back to tierLists[0] when the id is missing", () => {
    const lg = {
      ...twoLists(),
      activeTierListId: "gone",
      defaultTierListId: "gone",
    };
    expect(activeTierList(lg)).toBe(lg.tierLists[0]);
    expect(activeBoard(lg)).toEqual([player("a")]);
    expect(defaultBoard(lg)).toEqual([player("a")]);
  });
});

import { describe, it, expect } from "vitest";
import { defaultRoster, makeLeague } from "./league";
import type { Player } from "../types";

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
    expect(lg.board).toBe(board);
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
    expect(lg.board).toEqual([]);
  });

  it("gives distinct ids to distinct leagues", () => {
    expect(makeLeague({ name: "A" }).id).not.toBe(makeLeague({ name: "B" }).id);
  });
});

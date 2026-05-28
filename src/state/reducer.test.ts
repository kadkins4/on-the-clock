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

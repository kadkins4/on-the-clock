import { describe, it, expect } from "vitest";
import { withHistory, type HistoryState } from "./undoable";
import { leaguesReducer } from "./reducer";
import { loadLeagues } from "../lib/storage";
import { activeBoard } from "../lib/league";
import type { LeaguesState } from "../types";

// A tiny fake reducer to exercise the wrapper in isolation. "set" replaces the
// value (an undoable edit); "noop" returns the same reference; "switch" is a
// context change; "rename" is a pass-through.
type S = { value: number };
type A =
  | { type: "set"; value: number }
  | { type: "noop" }
  | { type: "switch" }
  | { type: "rename" };

const base = (s: S, a: A): S => {
  switch (a.type) {
    case "set":
      return { value: a.value };
    case "switch":
      return { value: 0 };
    case "rename":
      return { ...s };
    default:
      return s; // noop → same reference
  }
};

const wrapped = withHistory(base, {
  undoable: new Set(["set"]),
  clear: new Set(["switch"]),
  limit: 3,
});

const start = (value = 1): HistoryState<S> => ({
  past: [],
  present: { value },
});

describe("withHistory", () => {
  it("records a history entry on an undoable action", () => {
    const h = wrapped(start(1), { type: "set", value: 2 });
    expect(h.present.value).toBe(2);
    expect(h.past.map((p) => p.value)).toEqual([1]);
  });

  it("undo restores the previous present and pops history", () => {
    let h = wrapped(start(1), { type: "set", value: 2 });
    h = wrapped(h, { type: "undo" });
    expect(h.present.value).toBe(1);
    expect(h.past).toEqual([]);
  });

  it("supports multi-step undo", () => {
    let h = start(1);
    h = wrapped(h, { type: "set", value: 2 });
    h = wrapped(h, { type: "set", value: 3 });
    expect(h.past.map((p) => p.value)).toEqual([1, 2]);
    h = wrapped(h, { type: "undo" });
    expect(h.present.value).toBe(2);
    h = wrapped(h, { type: "undo" });
    expect(h.present.value).toBe(1);
  });

  it("caps history at the limit, dropping the oldest", () => {
    let h = start(0);
    for (let v = 1; v <= 5; v++) h = wrapped(h, { type: "set", value: v });
    // limit 3 → only the 3 most recent prior states are kept
    expect(h.past.map((p) => p.value)).toEqual([2, 3, 4]);
  });

  it("clears history on a context-change action", () => {
    let h = wrapped(start(1), { type: "set", value: 2 });
    h = wrapped(h, { type: "switch" });
    expect(h.present.value).toBe(0);
    expect(h.past).toEqual([]);
  });

  it("leaves history untouched for a pass-through action", () => {
    let h = wrapped(start(1), { type: "set", value: 2 });
    const before = h.past;
    h = wrapped(h, { type: "rename" });
    expect(h.past).toBe(before);
  });

  it("records nothing when the reducer returns the same state (no-op)", () => {
    const h0 = wrapped(start(1), { type: "set", value: 2 });
    const h1 = wrapped(h0, { type: "noop" });
    expect(h1).toBe(h0);
  });

  it("is a no-op when undo is called with empty history", () => {
    const h0 = start(5);
    const h1 = wrapped(h0, { type: "undo" });
    expect(h1).toBe(h0);
  });
});

describe("withHistory + leaguesReducer (integration)", () => {
  const wrapped = withHistory(leaguesReducer, {
    undoable: new Set(["setRank"]),
    clear: new Set(),
    limit: 10,
  });
  const board = (s: LeaguesState) =>
    activeBoard(s.leagues.find((l) => l.id === s.currentId)!);

  it("undoes a setRank, restoring the board order", () => {
    let h: HistoryState<LeaguesState> = { past: [], present: loadLeagues() };
    const order0 = board(h.present).map((p) => p.id);
    const firstId = order0[0];

    h = wrapped(h, { type: "setRank", id: firstId, rank: 3 });
    expect(board(h.present).map((p) => p.id)).not.toEqual(order0);
    expect(board(h.present)[2].id).toBe(firstId); // moved to rank 3

    h = wrapped(h, { type: "undo" });
    expect(board(h.present).map((p) => p.id)).toEqual(order0);
  });
});

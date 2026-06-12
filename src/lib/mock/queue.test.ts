import { describe, it, expect } from "vitest";
import { toggleQueue, pendingQueue } from "./queue";

describe("toggleQueue", () => {
  it("appends a new id to the end", () => {
    expect(toggleQueue([], "p1")).toEqual(["p1"]);
  });

  it("appends to the end of an existing list", () => {
    expect(toggleQueue(["p1", "p2"], "p3")).toEqual(["p1", "p2", "p3"]);
  });

  it("removes an id that is already present", () => {
    expect(toggleQueue(["p1", "p2", "p3"], "p2")).toEqual(["p1", "p3"]);
  });

  it("toggling an id absent then present then absent leaves original list", () => {
    const start: string[] = [];
    const after1 = toggleQueue(start, "p1");
    const after2 = toggleQueue(after1, "p1");
    expect(after2).toEqual([]);
  });

  it("preserves order of remaining ids when one is removed", () => {
    const ids = ["a", "b", "c", "d"];
    expect(toggleQueue(ids, "b")).toEqual(["a", "c", "d"]);
  });

  it("does not mutate the original array", () => {
    const ids = ["p1", "p2"];
    toggleQueue(ids, "p3");
    expect(ids).toEqual(["p1", "p2"]);
  });
});

describe("pendingQueue", () => {
  it("returns all ids when none are drafted", () => {
    expect(pendingQueue(["p1", "p2", "p3"], new Set())).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
  });

  it("filters out drafted ids", () => {
    expect(pendingQueue(["p1", "p2", "p3"], new Set(["p2"]))).toEqual([
      "p1",
      "p3",
    ]);
  });

  it("returns empty array when all are drafted", () => {
    expect(pendingQueue(["p1", "p2"], new Set(["p1", "p2"]))).toEqual([]);
  });

  it("preserves queue order after filtering", () => {
    const ids = ["c", "a", "b"];
    const drafted = new Set(["a"]);
    expect(pendingQueue(ids, drafted)).toEqual(["c", "b"]);
  });

  it("returns empty array for empty queue", () => {
    expect(pendingQueue([], new Set(["p1"]))).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const ids = ["p1", "p2"];
    pendingQueue(ids, new Set(["p1"]));
    expect(ids).toEqual(["p1", "p2"]);
  });
});

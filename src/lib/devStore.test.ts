import { describe, it, expect, beforeEach } from "vitest";
import {
  loadRefetchResult,
  saveRefetchResult,
  loadErrorLog,
  pushErrorLog,
  clearErrorLog,
} from "./storage";

beforeEach(() => localStorage.clear());

describe("dev store", () => {
  it("round-trips a refetch result", () => {
    expect(loadRefetchResult()).toBeNull();
    saveRefetchResult({ ok: true, at: 1, count: 500 });
    expect(loadRefetchResult()?.count).toBe(500);
  });
  it("buffers errors newest-first and clears", () => {
    pushErrorLog({ at: 1, message: "a", source: "onerror" });
    pushErrorLog({ at: 2, message: "b", source: "boundary" });
    const log = loadErrorLog();
    expect(log[0].message).toBe("b");
    expect(log.length).toBe(2);
    clearErrorLog();
    expect(loadErrorLog()).toEqual([]);
  });
  it("caps the error log at 50", () => {
    for (let i = 0; i < 60; i++)
      pushErrorLog({ at: i, message: String(i), source: "onerror" });
    expect(loadErrorLog().length).toBe(50);
  });
});

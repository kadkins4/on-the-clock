import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { safeStorage } from "./safeStorage";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("safeStorage", () => {
  it("reads and writes through to localStorage normally", () => {
    safeStorage.setItem("k", "v");
    expect(safeStorage.getItem("k")).toBe("v");
    expect(localStorage.getItem("k")).toBe("v");
  });

  it("returns null from getItem when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: storage blocked");
    });
    expect(safeStorage.getItem("k")).toBeNull();
  });

  it("swallows setItem when storage throws (e.g. quota / blocked)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => safeStorage.setItem("k", "v")).not.toThrow();
  });

  it("swallows removeItem when storage throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => safeStorage.removeItem("k")).not.toThrow();
  });
});

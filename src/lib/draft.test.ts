import { describe, it, expect } from "vitest";
import { nextDraftStatus } from "./draft";

describe("nextDraftStatus", () => {
  it("cycles available -> mine -> taken -> available", () => {
    expect(nextDraftStatus("available")).toBe("mine");
    expect(nextDraftStatus("mine")).toBe("taken");
    expect(nextDraftStatus("taken")).toBe("available");
  });
});

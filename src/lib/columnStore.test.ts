import { describe, it, expect, beforeEach } from "vitest";
import {
  loadColumnLayout,
  saveColumnLayout,
  loadColumnScopePref,
  saveColumnScopePref,
} from "./storage";
import { DEFAULT_LAYOUT, toggleHidden } from "./columnLayout";

beforeEach(() => localStorage.clear());

describe("column persistence", () => {
  it("defaults when unset", () => {
    expect(loadColumnLayout()).toEqual(DEFAULT_LAYOUT);
    expect(loadColumnScopePref()).toBe("ask");
  });
  it("round-trips a layout", () => {
    const l = toggleHidden(DEFAULT_LAYOUT, "vor");
    saveColumnLayout(l);
    expect(loadColumnLayout().hidden).toContain("vor");
  });
  it("round-trips scope pref", () => {
    saveColumnScopePref("this");
    expect(loadColumnScopePref()).toBe("this");
  });
  it("sanitizes malformed stored layout", () => {
    localStorage.setItem("otc:columns", "{bad json");
    expect(loadColumnLayout()).toEqual(DEFAULT_LAYOUT);
  });
});

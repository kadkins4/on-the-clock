import { describe, it, expect } from "vitest";
import { rowState } from "./rowState";

describe("rowState", () => {
  it("drafted status overrides flag color", () => {
    expect(rowState("mine", "target")).toBe("mine");
    expect(rowState("taken", "avoid")).toBe("taken");
  });

  it("uses flag color when available", () => {
    expect(rowState("available", "target")).toBe("target");
    expect(rowState("available", "avoid")).toBe("avoid");
    expect(rowState("available", "none")).toBe("neutral");
  });
});

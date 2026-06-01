import { describe, it, expect } from "vitest";
import { formatPick } from "./board";

describe("formatPick", () => {
  it("formats round and 2-digit slot within the round", () => {
    expect(formatPick(1, 12)).toBe("1.01");
    expect(formatPick(4, 12)).toBe("1.04");
    expect(formatPick(12, 12)).toBe("1.12");
  });

  it("rolls over to the next round", () => {
    expect(formatPick(13, 12)).toBe("2.01");
    expect(formatPick(25, 12)).toBe("3.01");
  });
});

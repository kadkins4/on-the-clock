import { describe, it, expect } from "vitest";
import { POSITION_COLOR, positionColor } from "./positionColor";
import { POSITIONS } from "../types";

describe("positionColor", () => {
  it("maps every Position to a non-empty hex color", () => {
    for (const pos of POSITIONS) {
      expect(POSITION_COLOR[pos]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("positionColor() returns the mapped color", () => {
    expect(positionColor("QB")).toBe(POSITION_COLOR.QB);
  });
  it("distinct colors for QB/RB/WR/TE", () => {
    const c = [
      POSITION_COLOR.QB,
      POSITION_COLOR.RB,
      POSITION_COLOR.WR,
      POSITION_COLOR.TE,
    ];
    expect(new Set(c).size).toBe(4);
  });
});

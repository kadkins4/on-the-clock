import { describe, it, expect } from "vitest";
import { pickSignal, fallenBy, defaultValueThreshold } from "./draftValue";

describe("defaultValueThreshold", () => {
  it("is 2*teams + 2", () => {
    expect(defaultValueThreshold(12)).toBe(26);
    expect(defaultValueThreshold(10)).toBe(22);
  });
});

describe("pickSignal", () => {
  it("flags a reach when taken earlier than baseline by >= threshold", () => {
    expect(pickSignal(40, 26, 14)).toEqual({ kind: "reach", amount: 14 });
  });
  it("flags a value when taken later than baseline by >= threshold", () => {
    expect(pickSignal(26, 40, 14)).toEqual({ kind: "value", amount: 14 });
  });
  it("is null within the threshold and for a null baseline", () => {
    expect(pickSignal(30, 26, 14)).toBeNull();
    expect(pickSignal(null, 26, 14)).toBeNull();
  });
  it("includes the exact-threshold boundary", () => {
    expect(pickSignal(40, 26, 14)).not.toBeNull();
  });
});

describe("fallenBy", () => {
  it("returns picks fallen when at/over threshold, else null", () => {
    expect(fallenBy(22, 40, 14)).toBe(18);
    expect(fallenBy(33, 40, 14)).toBeNull();
    expect(fallenBy(26, 40, 14)).toBe(14);
    expect(fallenBy(null, 40, 14)).toBeNull();
  });
});

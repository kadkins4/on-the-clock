import { describe, it, expect } from "vitest";
import { makeTeamIdentities } from "./teamIdentity";
import { READY_STRATEGY_IDS } from "./strategy";

describe("makeTeamIdentities", () => {
  it("returns one identity per team", () => {
    expect(makeTeamIdentities(10, 3, 42)).toHaveLength(10);
  });
  it("flags the user's slot (1-based) as isUser and names it 'Your Team'", () => {
    const t = makeTeamIdentities(10, 3, 42);
    expect(t[2].isUser).toBe(true);
    expect(t[2].name).toBe("Your Team");
    expect(t.filter((x) => x.isUser)).toHaveLength(1);
  });
  it("is deterministic for the same seed", () => {
    expect(makeTeamIdentities(12, 1, 7)).toEqual(makeTeamIdentities(12, 1, 7));
  });
  it("gives every team initials and a hex color", () => {
    for (const t of makeTeamIdentities(8, 1, 99)) {
      expect(t.initials).toMatch(/^[A-Z]{1,2}$/);
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("non-user names are unique within a draft", () => {
    const names = makeTeamIdentities(12, 1, 5)
      .filter((t) => !t.isUser)
      .map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives the user's team no strategy (they drive)", () => {
    const t = makeTeamIdentities(10, 3, 42);
    expect(t[2].strategy).toBeNull();
  });

  it("assigns every bot a ready strategy by default", () => {
    for (const t of makeTeamIdentities(12, 1, 5)) {
      if (t.isUser) continue;
      expect(READY_STRATEGY_IDS).toContain(t.strategy);
    }
  });

  it("varies the strategies across a full draft", () => {
    const strategies = makeTeamIdentities(12, 1, 5)
      .filter((t) => !t.isUser)
      .map((t) => t.strategy);
    expect(new Set(strategies).size).toBeGreaterThan(1);
  });

  it("assigns no personality to any bot when disabled", () => {
    for (const t of makeTeamIdentities(12, 1, 5, false)) {
      expect(t.strategy).toBeNull();
    }
  });
});

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

describe("makeTeamIdentities — bot mix", () => {
  const bots = (ts: ReturnType<typeof makeTeamIdentities>) =>
    ts.filter((t) => !t.isUser);

  it("honors an explicit strategy count as a floor (random fill may add more)", () => {
    // 12 teams, user in slot 1 → 11 bot seats. Explicit 3 is guaranteed; the
    // random fill draws from all ready strategies and may add another.
    const t = bots(makeTeamIdentities(12, 1, 5, true, { prospector: 3 }));
    expect(
      t.filter((x) => x.strategy === "prospector").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("maps a 'normal' count to personality-free bots", () => {
    const t = bots(makeTeamIdentities(12, 1, 5, true, { normal: 4 }));
    expect(t.filter((x) => x.strategy === null)).toHaveLength(4);
  });

  it("fills the remaining seats randomly from ready strategies", () => {
    const t = bots(makeTeamIdentities(12, 1, 5, true, { prospector: 2 }));
    // no null seats (none requested normal), and every non-prospector is ready
    for (const b of t) {
      expect(b.strategy).not.toBeNull();
      expect(READY_STRATEGY_IDS).toContain(b.strategy);
    }
    expect(
      t.filter((x) => x.strategy === "prospector").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("caps counts that exceed the available bot seats", () => {
    const t = bots(makeTeamIdentities(12, 1, 5, true, { normal: 100 }));
    expect(t).toHaveLength(11);
    expect(t.every((x) => x.strategy === null)).toBe(true);
  });

  it("is deterministic for the same seed and mix", () => {
    const mix = { prospector: 2, graybeard: 1, normal: 2 };
    expect(makeTeamIdentities(12, 1, 9, true, mix)).toEqual(
      makeTeamIdentities(12, 1, 9, true, mix),
    );
  });

  it("ignores the mix entirely when personalities are disabled", () => {
    for (const t of bots(
      makeTeamIdentities(12, 1, 5, false, { prospector: 5 }),
    )) {
      expect(t.strategy).toBeNull();
    }
  });

  it("treats an empty mix like the random default (no null bots)", () => {
    for (const t of bots(makeTeamIdentities(12, 1, 5, true, {}))) {
      expect(t.strategy).not.toBeNull();
    }
  });
});

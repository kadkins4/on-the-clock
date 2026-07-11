import { describe, it, expect } from "vitest";
import { botStrategyReveal } from "./reveal";
import type { TeamIdentity } from "./teamIdentity";

const team = (
  name: string,
  isUser: boolean,
  strategy: TeamIdentity["strategy"],
): TeamIdentity => ({ name, initials: "XX", color: "#000", isUser, strategy });

describe("botStrategyReveal", () => {
  it("returns each bot with its strategy icon, label, and blurb", () => {
    const rows = botStrategyReveal([
      team("Your Team", true, null),
      team("Team Beta", false, "zeroRB"),
    ]);
    expect(rows).toEqual([
      {
        name: "Team Beta",
        icon: "0️⃣",
        label: "Volume Hunter",
        blurb: "Zero RB — WRs early, hammer RB value in the middle rounds.",
      },
    ]);
  });

  it("omits the user's team", () => {
    const rows = botStrategyReveal([team("Your Team", true, "zeroRB")]);
    expect(rows).toEqual([]);
  });

  it("omits bots with no personality (toggle off)", () => {
    const rows = botStrategyReveal([
      team("Team Beta", false, null),
      team("Team Gamma", false, "heroRB"),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Team Gamma"]);
  });
});

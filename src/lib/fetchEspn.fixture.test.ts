import { describe, it, expect } from "vitest";
import { mapEspnPlayers, validateEspnShape } from "./fetchEspn";
import sample from "./__fixtures__/espn-sample.json";

// Regression guard: feed a captured ESPN-shaped sample through our mapping so a
// silent change to mapEspnPlayers (field names, nesting) is caught in CI.
describe("ESPN fixture mapping (regression guard)", () => {
  it("maps the captured sample to FetchedPlayer rows", () => {
    const out = mapEspnPlayers(sample as never);
    expect(out.length).toBeGreaterThan(0);
    const first = out[0];
    expect(first.id).toBeTruthy();
    expect(first.name).toBeTruthy();
    expect(["QB", "RB", "WR", "TE", "K", "DST"]).toContain(first.position);
    expect(typeof first.overallRank).toBe("number");
  });

  it("carries projected + last-season lines through for skill players", () => {
    const out = mapEspnPlayers(sample as never);
    const back = out.find((p) => p.position === "RB");
    expect(back?.projStats).toBeTruthy();
    expect(back?.lastStats).toBeTruthy();
    expect(back?.projPoints).toBe(312.5);
  });

  it("count threshold is separate from mapping (small sample maps fine)", () => {
    // the fixture is intentionally tiny; only validateEspnShape enforces ≥200
    expect(typeof validateEspnShape).toBe("function");
    expect(mapEspnPlayers(sample as never).length).toBe(3);
  });
});

import { describe, it, expect } from "vitest";
import { mapSleeperAdp } from "./sleeper";

const rows = [
  {
    team: "ATL",
    player: { first_name: "Bijan", last_name: "Robinson", position: "RB" },
    stats: { adp_ppr: 6.5, adp_half_ppr: 7.0, adp_std: 8.0 },
  },
  {
    team: "SF",
    player: { first_name: "Jordan", last_name: "Mason", position: "RB" },
    stats: { adp_ppr: 999, adp_half_ppr: 999, adp_std: 999 }, // undrafted → dropped
  },
  {
    team: "BAL",
    player: { first_name: "Baltimore", last_name: "", position: "DEF" },
    stats: { adp_ppr: 130 },
  },
];

describe("mapSleeperAdp", () => {
  it("pulls the scoring-appropriate ADP field", () => {
    expect(mapSleeperAdp(rows, "ppr")[0].adp).toBe(6.5);
    expect(mapSleeperAdp(rows, "half")[0].adp).toBe(7.0);
    expect(mapSleeperAdp(rows, "standard")[0].adp).toBe(8.0);
  });

  it("drops undrafted (>=900) rows and maps DEF→DST", () => {
    const out = mapSleeperAdp(rows, "ppr");
    expect(out.map((r) => r.name)).toEqual(["Bijan Robinson", "Baltimore"]);
    expect(out[1].position).toBe("DST");
    expect(out[1].team).toBe("BAL");
  });

  it("returns [] for non-array input", () => {
    expect(mapSleeperAdp(null, "ppr")).toEqual([]);
  });
});

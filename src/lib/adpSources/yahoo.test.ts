import { describe, it, expect } from "vitest";
import { mapYahooAdp } from "./yahoo";

// Trimmed shape of Yahoo's players;out=draft_analysis JSON. Each player is a
// 2-element array: [ metadata-array, { draft_analysis: [...] } ]. The metadata
// array is itself a list of single-key objects.
const JSON_FIXTURE = {
  fantasy_content: {
    game: [
      { code: "nfl" },
      {
        players: {
          "0": {
            player: [
              [
                { player_key: "461.p.100" },
                { player_id: "100" },
                { name: { full: "Jahmyr Gibbs" } },
                { editorial_team_abbr: "DET" },
                { display_position: "RB" },
              ],
              { draft_analysis: [{ average_pick: "5.3" }] },
            ],
          },
          "1": {
            player: [
              [
                { name: { full: "Houston Texans" } },
                { editorial_team_abbr: "Hou" },
                { display_position: "DEF" },
              ],
              { draft_analysis: [{ average_pick: "141.0" }] },
            ],
          },
          count: 2,
        },
      },
    ],
  },
};

describe("mapYahooAdp", () => {
  it("maps an offensive player", () => {
    const out = mapYahooAdp(JSON_FIXTURE);
    expect(out).toContainEqual({
      name: "Jahmyr Gibbs",
      position: "RB",
      team: "DET",
      adp: 5.3,
    });
  });
  it("maps a defense to DST with an uppercased team", () => {
    const out = mapYahooAdp(JSON_FIXTURE);
    expect(out).toContainEqual({
      name: "Houston Texans",
      position: "DST",
      team: "HOU",
      adp: 141,
    });
  });
  it("ignores the numeric count key", () => {
    expect(mapYahooAdp(JSON_FIXTURE)).toHaveLength(2);
  });
});

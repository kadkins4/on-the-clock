import { describe, it, expect } from "vitest";
import { parseFantasyPros } from "./fantasypros";

// Minimal fixture mirroring the real FantasyPros ADP table row shape.
const HTML = `
<table><tbody>
<tr><th>Rank</th><th>Player</th><th>POS</th><th>AVG</th></tr>
<tr>
  <td>1</td>
  <td class="player-label player-label-report-page">
    <a class="player-name fp-player-link fp-id-22968" fp-player-name="Jahmyr Gibbs" href="/nfl/players/jahmyr-gibbs.php">Jahmyr Gibbs</a> <small>DET (8)</small>
  </td>
  <td>RB1</td>
  <td>1.5</td>
</tr>
<tr>
  <td>199</td>
  <td class="player-label">
    <a class="player-name fp-player-link fp-id-8120" fp-player-name="Houston Texans" href="/nfl/teams/houston-defense.php">Houston Texans</a>
  </td>
  <td>DST1</td>
  <td>141.0</td>
</tr>
</tbody></table>
`;

describe("parseFantasyPros", () => {
  it("parses an offensive player with team from <small>", () => {
    const out = parseFantasyPros(HTML);
    const gibbs = out.find((p) => p.name === "Jahmyr Gibbs");
    expect(gibbs).toEqual({
      name: "Jahmyr Gibbs",
      position: "RB",
      team: "DET",
      adp: 1.5,
    });
  });
  it("parses a defense, mapping full name to a team abbr", () => {
    const out = parseFantasyPros(HTML);
    const def = out.find((p) => p.position === "DST");
    expect(def).toEqual({
      name: "Houston Texans",
      position: "DST",
      team: "HOU",
      adp: 141,
    });
  });
  it("skips the header row", () => {
    expect(parseFantasyPros(HTML)).toHaveLength(2);
  });

  it("skips a row with a blank AVG cell (no phantom adp:0)", () => {
    const html = `
<table><tbody>
<tr><th>Rank</th><th>Player</th><th>POS</th><th>AVG</th></tr>
<tr>
  <td>250</td>
  <td class="player-label"><a fp-player-name="Deep Sleeper" href="#">Deep Sleeper</a> <small>SF</small></td>
  <td>WR80</td>
  <td></td>
</tr>
</tbody></table>`;
    expect(parseFantasyPros(html)).toHaveLength(0);
  });

  it("reads AVG by header index, not the last cell, when extra columns exist", () => {
    // AVG is column 3; a trailing 'vs. ADP' column must not be misread as ADP.
    const html = `
<table><tbody>
<tr><th>Rank</th><th>Player</th><th>POS</th><th>AVG</th><th>vs. ADP</th></tr>
<tr>
  <td>1</td>
  <td class="player-label"><a fp-player-name="Jahmyr Gibbs" href="#">Jahmyr Gibbs</a> <small>DET</small></td>
  <td>RB1</td>
  <td>3.2</td>
  <td>+0.5</td>
</tr>
</tbody></table>`;
    const out = parseFantasyPros(html);
    expect(out).toHaveLength(1);
    expect(out[0].adp).toBe(3.2);
  });
});

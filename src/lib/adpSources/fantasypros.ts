import type { Position } from "../../types";
import type { NormalizedAdp } from "../ffcAdp";

const FP_POS: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DST: "DST",
};

// FantasyPros lists defenses by full team name with no abbreviation; map them.
const DEF_NAME_TO_ABBR: Record<string, string> = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC",
  "Las Vegas Raiders": "LV",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NE",
  "New Orleans Saints": "NO",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WSH",
};

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();

// Locate the AVG (ADP) column by its header so an added/reordered column can't
// silently shift which cell we read. Falls back to null (→ last cell) if the
// header can't be found. Header <th> indices align with data-row <td> indices.
function avgColumnIndex(html: string): number | null {
  const headerRow = html
    .match(/<tr[^>]*>[\s\S]*?<\/tr>/g)
    ?.find((r) => /<th/.test(r));
  if (!headerRow) return null;
  const headers = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(
    (m) => stripTags(m[1]).toUpperCase(),
  );
  const idx = headers.findIndex((h) => h === "AVG" || h.startsWith("AVG"));
  return idx >= 0 ? idx : null;
}

// Parse the FantasyPros ADP page (server-rendered table) into NormalizedAdp.
export function parseFantasyPros(html: string): NormalizedAdp[] {
  const out: NormalizedAdp[] = [];
  const avgIdx = avgColumnIndex(html);
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const inner = row[1];
    if (!/fp-player-name/.test(inner)) continue; // skip header/empty rows
    const name = inner.match(/fp-player-name="([^"]+)"/)?.[1];
    const posCode = inner.match(/<td[^>]*>(QB|RB|WR|TE|K|DST)\d*<\/td>/)?.[1];
    const tds = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (m) => m[1],
    );
    const avgCell = avgIdx != null ? tds[avgIdx] : tds[tds.length - 1];
    const adp = Number(stripTags(avgCell ?? ""));
    // adp <= 0 catches blank/zero AVG cells (Number("") === 0) — without this a
    // phantom adp:0 would sort to the top and poison the weighted blend.
    if (!name || !posCode || !Number.isFinite(adp) || adp <= 0) continue;
    const position = FP_POS[posCode];
    const team =
      position === "DST"
        ? (DEF_NAME_TO_ABBR[name] ?? "")
        : (inner.match(/<small>([A-Z]{2,3})/)?.[1] ?? "");
    out.push({ name, position, team, adp });
  }
  return out;
}

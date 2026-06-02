// Re-pull ESPN fantasy rankings and regenerate src/data/seed.json.
// Run: npm run fetch-espn
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEASON = 2026;
const LIMIT = 500;
const TIER_SIZE = 12; // ~one draft round per tier

const OFFENSE = ["QB", "RB", "WR", "TE"];
// ESPN projected stat ids (kept in sync with src/lib/fetchEspn.ts).
const STAT = {
  passYds: "3",
  passTD: "4",
  int: "20",
  rushYds: "24",
  rushTD: "25",
  rec: "53",
  recYds: "42",
  recTD: "43",
  fumblesLost: "72",
  pass2: "19",
  rush2: "26",
  rec2: "44",
};

// The player's 2026 projected season row (projected, full-season split).
const projRow = (p) =>
  p.stats?.find(
    (x) =>
      x.statSourceId === 1 && x.statSplitTypeId === 0 && x.seasonId === SEASON,
  );

// Raw projected stat line for an offensive player; null for K/DST or no line.
function extractProjStats(p, position) {
  if (!OFFENSE.includes(position)) return null;
  const st = projRow(p)?.stats;
  if (!st) return null;
  const g = (k) => Number(st[k]) || 0;
  return {
    passYds: g(STAT.passYds),
    passTD: g(STAT.passTD),
    int: g(STAT.int),
    rushYds: g(STAT.rushYds),
    rushTD: g(STAT.rushTD),
    rec: g(STAT.rec),
    recYds: g(STAT.recYds),
    recTD: g(STAT.recTD),
    fumblesLost: g(STAT.fumblesLost),
    twoPt: g(STAT.pass2) + g(STAT.rush2) + g(STAT.rec2),
  };
}

const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST" };
const TEAM = {
  0: "FA",
  1: "ATL",
  2: "BUF",
  3: "CHI",
  4: "CIN",
  5: "CLE",
  6: "DAL",
  7: "DEN",
  8: "DET",
  9: "GB",
  10: "TEN",
  11: "IND",
  12: "KC",
  13: "LV",
  14: "LAR",
  15: "MIA",
  16: "MIN",
  17: "NE",
  18: "NO",
  19: "NYG",
  20: "NYJ",
  21: "PHI",
  22: "ARI",
  23: "PIT",
  24: "LAC",
  25: "SF",
  26: "SEA",
  27: "TB",
  28: "WSH",
  29: "CAR",
  30: "JAX",
  33: "BAL",
  34: "HOU",
};

const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/players?view=kona_player_info`;
const filter = {
  players: {
    limit: LIMIT,
    sortDraftRanks: { sortPriority: 100, sortAsc: true, value: "PPR" },
  },
};

const res = await fetch(url, {
  headers: {
    "x-fantasy-filter": JSON.stringify(filter),
    accept: "application/json",
  },
});
if (!res.ok) {
  console.error(`ESPN request failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const data = await res.json();
const raw = Array.isArray(data.players) ? data.players : data;

const players = [];
for (const entry of raw) {
  const p = entry.player ?? entry;
  const position = POS[p.defaultPositionId];
  if (!position) continue;
  const pprRank = p.draftRanksByRankType?.PPR?.rank ?? null;
  if (pprRank === null) continue; // skip unranked players
  players.push({
    id: String(p.id),
    name: p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
    position,
    team: TEAM[p.proTeamId] ?? "FA",
    overallRank: pprRank,
    byeWeek: null,
    tier: null,
    adp: p.ownership?.averageDraftPosition ?? null,
    projStats: extractProjStats(p, position),
    projPoints: projRow(p)?.appliedTotal ?? null,
    notes: "",
    flag: "none",
    draftStatus: "available",
    ...(p.injuryStatus && p.injuryStatus !== "ACTIVE"
      ? { injuryStatus: p.injuryStatus }
      : {}),
  });
}

players.sort(
  (a, b) => a.overallRank - b.overallRank || Number(a.id) - Number(b.id),
);
const top = players.slice(0, LIMIT);
top.forEach((p, i) => {
  p.overallRank = i + 1;
  p.tier = Math.floor(i / TIER_SIZE) + 1;
});

if (top.length === 0) {
  console.error(
    "No ranked players returned from ESPN — refusing to write an empty seed.",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "src", "data", "seed.json");
writeFileSync(out, JSON.stringify(top, null, 2) + "\n");
console.log(`Wrote ${top.length} players to ${out}`);

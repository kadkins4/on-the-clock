// Re-pull ESPN fantasy rankings and regenerate src/data/seed.json.
// Run: npm run fetch-espn
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEASON = 2026;
const LIMIT = 300;
const TIER_SIZE = 12; // ~one draft round per tier

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
    notes: "",
    flag: "none",
    drafted: false,
  });
}

players.sort((a, b) => a.overallRank - b.overallRank);
const top = players.slice(0, LIMIT);
top.forEach((p, i) => {
  p.overallRank = i + 1;
  p.tier = Math.floor(i / TIER_SIZE) + 1;
});

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "src", "data", "seed.json");
writeFileSync(out, JSON.stringify(top, null, 2) + "\n");
console.log(`Wrote ${top.length} players to ${out}`);

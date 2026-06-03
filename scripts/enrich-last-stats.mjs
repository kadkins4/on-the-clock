// Add ONLY `lastStats` (last-season actuals) to each existing seed player by
// ESPN id. Does NOT reorder, re-rank, or change ADP/projStats/anything else —
// it reads the current seed, fetches ESPN once, and writes the same array back
// with a `lastStats` field inserted after `projStats`.
// Run: node scripts/enrich-last-stats.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEASON = 2026;
const LAST_SEASON = SEASON - 1; // 2025 actuals
const OFFENSE = ["QB", "RB", "WR", "TE"];
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
const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST" };

const lastRow = (p) =>
  p.stats?.find(
    (x) =>
      x.statSourceId === 0 &&
      x.statSplitTypeId === 0 &&
      x.seasonId === LAST_SEASON,
  );

function extractLastStats(p, position) {
  if (!OFFENSE.includes(position)) return null;
  const st = lastRow(p)?.stats;
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

const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/players?view=kona_player_info`;
const filter = {
  players: {
    limit: 1500,
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

const byId = new Map();
for (const entry of raw) {
  const p = entry.player ?? entry;
  const position = POS[p.defaultPositionId];
  if (!position) continue;
  byId.set(String(p.id), extractLastStats(p, position));
}

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "src", "data", "seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const players = Array.isArray(seed) ? seed : seed.players;

let hit = 0;
const enriched = players.map((pl) => {
  const ls = byId.get(String(pl.id));
  if (!ls) return pl;
  hit++;
  // Rebuild the object so `lastStats` lands right after `projStats`, keeping
  // every other field and its order intact.
  const out = {};
  for (const [k, v] of Object.entries(pl)) {
    out[k] = v;
    if (k === "projStats") out.lastStats = ls;
  }
  if (!("lastStats" in out)) out.lastStats = ls; // no projStats key → append
  return out;
});

const result = Array.isArray(seed) ? enriched : { ...seed, players: enriched };
writeFileSync(seedPath, JSON.stringify(result, null, 2) + "\n");
console.log(`enriched ${hit} of ${players.length} players with lastStats`);

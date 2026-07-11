// Add ONLY `age` and `yearsExp` to each existing seed player, sourced from
// Sleeper's player map. Does NOT reorder, re-rank, or change anything else — it
// reads the current seed, fetches Sleeper once, and writes the same array back
// with the two bio fields inserted after `injuryStatus` (or appended).
//
// Match strategy: primarily by Sleeper's `espn_id` (== seed id). Sleeper omits
// espn_id for many stars (e.g. Bijan Robinson), so we fall back to a normalized
// `name|position` key. years_exp coverage is ~100%, age ~92% of skill players.
// Run: node scripts/enrich-bio.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Strip punctuation, common suffixes, and collapse whitespace so
// "A.J. Brown" / "AJ Brown" and "Michael Pittman Jr." / "Michael Pittman"
// collide the same way across the two feeds.
const normName = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[.'`-]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const res = await fetch("https://api.sleeper.app/v1/players/nfl", {
  headers: { accept: "application/json" },
});
if (!res.ok) {
  console.error(`Sleeper request failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const map = await res.json();

const byEspnId = new Map(); // "12345" -> { age, yearsExp }
const byNameKey = new Map(); // "patrick mahomes|QB" -> { age, yearsExp }
for (const raw of Object.values(map)) {
  if (!raw || typeof raw !== "object") continue;
  const bio = { age: num(raw.age), yearsExp: num(raw.years_exp) };
  if (bio.age == null && bio.yearsExp == null) continue;
  const espnId = raw.espn_id == null ? null : String(raw.espn_id);
  if (espnId && !byEspnId.has(espnId)) byEspnId.set(espnId, bio);
  const name =
    raw.full_name ?? [raw.first_name, raw.last_name].filter(Boolean).join(" ");
  const key = `${normName(name)}|${raw.position ?? ""}`;
  if (normName(name) && !byNameKey.has(key)) byNameKey.set(key, bio);
}

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "src", "data", "seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const players = Array.isArray(seed) ? seed : seed.players;

let hitId = 0;
let hitName = 0;
let miss = 0;
const enriched = players.map((pl) => {
  let bio = byEspnId.get(String(pl.id));
  if (bio) hitId++;
  else {
    bio = byNameKey.get(`${normName(pl.name)}|${pl.position}`);
    if (bio) hitName++;
  }
  if (!bio) {
    miss++;
    return pl;
  }
  // Rebuild so `age`/`yearsExp` land right after `injuryStatus`, keeping every
  // other field and its order intact. Append if no injuryStatus key.
  const out = {};
  let placed = false;
  for (const [k, v] of Object.entries(pl)) {
    if (k === "age" || k === "yearsExp") continue; // drop any stale copies
    out[k] = v;
    if (k === "injuryStatus") {
      out.age = bio.age;
      out.yearsExp = bio.yearsExp;
      placed = true;
    }
  }
  if (!placed) {
    out.age = bio.age;
    out.yearsExp = bio.yearsExp;
  }
  return out;
});

const result = Array.isArray(seed) ? enriched : { ...seed, players: enriched };
writeFileSync(seedPath, JSON.stringify(result, null, 2) + "\n");
console.log(
  `enriched ${hitId + hitName} of ${players.length} (${hitId} by espn_id, ${hitName} by name); ${miss} unmatched`,
);

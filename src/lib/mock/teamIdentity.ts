import { READY_STRATEGY_IDS, type StrategyId } from "./strategy";

export interface TeamIdentity {
  name: string;
  initials: string;
  color: string;
  isUser: boolean;
  // The bot's draft personality. `null` for the user's team, and for every bot
  // when personalities are disabled.
  strategy: StrategyId | null;
}

// Curated, license-safe fun manager names.
const NAMES = [
  "Bed Bath & Bijan",
  "Caleb Me Maybe",
  "Tua Towers",
  "Amon a Mission",
  "Knockin' Evans",
  "Saquon the Barker",
  "Hurts So Good",
  "Chase the Bag",
  "Lamb Chops",
  "CMC Hammer",
  "Kelce Grammer",
  "Puka Matata",
  "Nabers Hood",
  "Jefferson Airplane",
  "Gibbs Me More",
  "London Calling",
];
const COLORS = [
  "#e11d48",
  "#7c3aed",
  "#0891b2",
  "#16a34a",
  "#ea580c",
  "#2563eb",
  "#db2777",
  "#0d9488",
  "#ca8a04",
  "#4f46e5",
  "#65a30d",
  "#c026d3",
  "#dc2626",
  "#0284c7",
  "#9333ea",
  "#15803d",
];

// Mulberry32 — small deterministic PRNG.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function initials(name: string): string {
  const words = name
    .replace(/[^A-Za-z ]/g, "")
    .trim()
    .split(/\s+/);
  const ltrs = (words[0]?.[0] ?? "T") + (words[1]?.[0] ?? "");
  return ltrs.toUpperCase().slice(0, 2);
}

// Generate identities; userSlot is 1-based. Names/colors shuffled by seed; the
// user's slot is always "Your Team". When `personalities` is true (default),
// each bot gets a seeded draft strategy; when false, every bot is neutral.
export function makeTeamIdentities(
  teams: number,
  userSlot: number,
  seed: number,
  personalities: boolean = true,
): TeamIdentity[] {
  const r = rng(seed);
  const pool = NAMES.slice();
  // Fisher–Yates shuffle of the name pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Seeded shuffle of the ready strategies, cycled across the bots so a draft
  // gets a varied but reproducible mix.
  const strat = READY_STRATEGY_IDS.slice();
  for (let i = strat.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [strat[i], strat[j]] = [strat[j], strat[i]];
  }
  const out: TeamIdentity[] = [];
  let n = 0;
  let s = 0;
  for (let t = 0; t < teams; t++) {
    const isUser = t === userSlot - 1;
    const name = isUser ? "Your Team" : pool[n++ % pool.length];
    const strategy =
      isUser || !personalities ? null : strat[s++ % strat.length];
    out.push({
      name,
      initials: isUser ? "YT" : initials(name),
      color: COLORS[t % COLORS.length],
      isUser,
      strategy,
    });
  }
  return out;
}

import { READY_STRATEGY_IDS, type StrategyId, type BotMix } from "./strategy";

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

// Seeded Fisher–Yates shuffle in place.
function shuffle<T>(arr: T[], r: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build the per-seat strategy assignments for `seats` bots. Explicit `botMix`
// counts are honored first ("normal" → null, a personality-free bot), capped at
// the seat count; any leftover seats are filled from a seeded shuffle of the
// ready strategies. The whole list is then shuffled so explicit picks aren't
// clustered into adjacent slots. An absent/empty mix fills every seat randomly.
function assignStrategies(
  seats: number,
  seed: number,
  botMix: BotMix | undefined,
): (StrategyId | null)[] {
  const r = rng(seed);
  const explicit: (StrategyId | null)[] = [];
  if (botMix) {
    for (const [key, count] of Object.entries(botMix)) {
      const c = Math.max(0, Math.floor(count ?? 0));
      for (let i = 0; i < c && explicit.length < seats; i++) {
        explicit.push(key === "normal" ? null : (key as StrategyId));
      }
    }
  }
  const strat = shuffle(READY_STRATEGY_IDS.slice(), r);
  const fill: (StrategyId | null)[] = [];
  for (let i = 0; explicit.length + fill.length < seats; i++) {
    fill.push(strat[i % strat.length]);
  }
  return shuffle([...explicit, ...fill], r);
}

// Generate identities; userSlot is 1-based. Names/colors shuffled by seed; the
// user's slot is always "Your Team". When `personalities` is false, every bot is
// neutral. When true, bot strategies come from `botMix` (explicit counts +
// random fill); an absent/empty mix fills every bot randomly from ready ones.
export function makeTeamIdentities(
  teams: number,
  userSlot: number,
  seed: number,
  personalities: boolean = true,
  botMix?: BotMix,
): TeamIdentity[] {
  const r = rng(seed);
  const pool = shuffle(NAMES.slice(), r);
  // One strategy per bot seat (teams minus the user's slot).
  const assignments = personalities
    ? assignStrategies(Math.max(0, teams - 1), seed ^ 0x9e3779b9, botMix)
    : [];
  const out: TeamIdentity[] = [];
  let n = 0;
  let s = 0;
  for (let t = 0; t < teams; t++) {
    const isUser = t === userSlot - 1;
    const name = isUser ? "Your Team" : pool[n++ % pool.length];
    const strategy =
      isUser || !personalities ? null : (assignments[s++] ?? null);
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

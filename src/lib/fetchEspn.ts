import type { Player, Position, ProjStats } from "../types";
import { normalizeTiers, reassignOverallRanks } from "./ranking";
import { blendAdp } from "./blendAdp";
import { OFFENSE } from "./projection";

const SEASON = 2026;
const LIMIT = 500; // ESPN ignores the filter's limit, so we cap here (matches seed)

export interface FetchedPlayer {
  id: string;
  name: string;
  position: Position;
  team: string;
  overallRank: number; // ESPN PPR rank, 1-based and contiguous
  adp: number | null;
  projStats?: ProjStats | null;
  lastStats?: ProjStats | null;
  projPoints?: number | null;
  injuryStatus?: string;
}

interface EspnStat {
  seasonId?: number;
  statSourceId?: number; // 0 = actual, 1 = projected
  statSplitTypeId?: number; // 0 = season total
  appliedTotal?: number;
  stats?: Record<string, number>; // raw stat-id → projected value
}

// ESPN projected stat ids (validated against their precomputed PPR totals).
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
} as const;

const POS: Record<number, Position> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

const TEAM: Record<number, string> = {
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

interface EspnEntry {
  player?: EspnPlayer;
}
interface EspnPlayer {
  id: number | string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  defaultPositionId: number;
  proTeamId?: number;
  draftRanksByRankType?: { PPR?: { rank?: number } };
  ownership?: { averageDraftPosition?: number };
  injuryStatus?: string;
  stats?: EspnStat[];
}

// The player's projected season row in kona_player_info: statSourceId 1
// (projected), split 0 (full season), for the draft year.
function projRow(p: { stats?: EspnStat[] }): EspnStat | undefined {
  return p.stats?.find(
    (x) =>
      x.statSourceId === 1 && x.statSplitTypeId === 0 && x.seasonId === SEASON,
  );
}

// ESPN's own precomputed projected total. Sparse today (only a few dozen
// players), so it's used only as the K/DST fallback for projected points.
export function appliedProjTotal(p: { stats?: EspnStat[] }): number | null {
  const s = projRow(p);
  return s && s.appliedTotal != null ? s.appliedTotal : null;
}

// Fantasy-relevant raw projected stats for an offensive player. Null for K/DST
// or when ESPN has not published a projection line yet.
export function extractProjStats(
  p: { stats?: EspnStat[] },
  position: Position,
): ProjStats | null {
  if (!OFFENSE.includes(position)) return null;
  const st = projRow(p)?.stats;
  if (!st) return null;
  const g = (k: string) => Number(st[k]) || 0;
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

const LAST_SEASON = SEASON - 1; // last completed season's actuals

// The player's prior-season ACTUAL row: statSourceId 0 (actual), split 0.
function lastRow(p: { stats?: EspnStat[] }): EspnStat | undefined {
  return p.stats?.find(
    (x) =>
      x.statSourceId === 0 &&
      x.statSplitTypeId === 0 &&
      x.seasonId === LAST_SEASON,
  );
}

// Fantasy-relevant raw last-season actual stats for an offensive player. Null
// for K/DST, rookies, or anyone without a prior-season line.
export function extractLastStats(
  p: { stats?: EspnStat[] },
  position: Position,
): ProjStats | null {
  if (!OFFENSE.includes(position)) return null;
  const st = lastRow(p)?.stats;
  if (!st) return null;
  const g = (k: string) => Number(st[k]) || 0;
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

// Mirror of scripts/fetch-espn.mjs: filter to ranked, known-position players,
// sort by PPR rank, and assign a contiguous 1-based overall rank.
export type ShapeResult =
  | { ok: true; ranked: number }
  | { ok: false; reason: string; fingerprint: string };

export class EspnShapeError extends Error {
  fingerprint: string;
  constructor(reason: string, fingerprint: string) {
    super(reason);
    this.name = "EspnShapeError";
    this.fingerprint = fingerprint;
  }
}

const MIN_RANKED = 200; // healthy pulls return ~500; far fewer ⇒ shape change
const SPOT_CHECK = 10;

// Validate-at-the-boundary: a malformed ESPN payload must never reach state.
export function validateEspnShape(rawPlayers: unknown): ShapeResult {
  if (!Array.isArray(rawPlayers)) {
    return { ok: false, reason: "not-array", fingerprint: "players=not-array" };
  }
  const rows = rawPlayers as EspnEntry[];
  // count rows that carry a PPR rank (what we actually map)
  let ranked = 0;
  for (const e of rows) {
    const p = e.player ?? (e as unknown as EspnPlayer);
    if (p?.draftRanksByRankType?.PPR?.rank != null) ranked++;
  }
  if (ranked < MIN_RANKED) {
    return {
      ok: false,
      reason: "too-few-ranked",
      fingerprint: `ranked=${ranked} total=${rows.length}`,
    };
  }
  // Spot-check the first N rows we'd actually map (ESPN's payload isn't sorted
  // by rank and carries unranked/IDP rows, so we filter to mappable candidates —
  // a PPR rank + a known position — then sanity-check id + ADP range on those).
  let checked = 0;
  let bad = 0;
  let firstBad = "";
  for (const e of rows) {
    const p = e.player ?? (e as unknown as EspnPlayer);
    const rank = p?.draftRanksByRankType?.PPR?.rank;
    if (rank == null || POS[p?.defaultPositionId] == null) continue;
    const adp = p?.ownership?.averageDraftPosition ?? 0;
    const ok = p.id != null && rank >= 1 && adp >= 0 && adp <= 400;
    if (!ok) {
      bad++;
      if (!firstBad) firstBad = (JSON.stringify(p) ?? "null").slice(0, 120);
    }
    if (++checked >= SPOT_CHECK) break;
  }
  if (checked === 0 || bad > SPOT_CHECK / 2) {
    return {
      ok: false,
      reason: "rows-malformed",
      fingerprint: `bad=${bad}/${checked} first=${firstBad}`,
    };
  }
  return { ok: true, ranked };
}

export function mapEspnPlayers(raw: EspnEntry[]): FetchedPlayer[] {
  const out: FetchedPlayer[] = [];
  for (const entry of raw) {
    const p = entry.player ?? (entry as unknown as EspnPlayer);
    const position = POS[p.defaultPositionId];
    if (!position) continue;
    const pprRank = p.draftRanksByRankType?.PPR?.rank ?? null;
    if (pprRank === null) continue;
    out.push({
      id: String(p.id),
      name: p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
      position,
      team: TEAM[p.proTeamId ?? 0] ?? "FA",
      overallRank: pprRank,
      adp: p.ownership?.averageDraftPosition ?? null,
      projStats: extractProjStats(p, position),
      lastStats: extractLastStats(p, position),
      projPoints: appliedProjTotal(p),
      ...(p.injuryStatus && p.injuryStatus !== "ACTIVE"
        ? { injuryStatus: p.injuryStatus }
        : {}),
    });
  }
  out.sort(
    (a, b) => a.overallRank - b.overallRank || Number(a.id) - Number(b.id),
  );
  const top = out.slice(0, LIMIT);
  top.forEach((p, i) => {
    p.overallRank = i + 1;
  });
  return top;
}

// Merge a fresh ESPN pull into the current board without wiping user curation.
// - existing players keep their order, tier, flag, draft status and notes;
//   their objective fields (name, position, team, adp, injury) refresh.
// - new players are inserted at their ESPN-rank slot and adopt the tier above.
// - players not present in the fetch (e.g. manual adds) are left untouched.
export function mergeFetched(
  current: Player[],
  fetched: FetchedPlayer[],
): Player[] {
  const fetchedById = new Map(fetched.map((f) => [f.id, f]));
  const currentIds = new Set(current.map((p) => p.id));

  const updated = current
    .slice()
    .sort((a, b) => a.overallRank - b.overallRank)
    .map((p) => {
      const f = fetchedById.get(p.id);
      if (!f) return p;
      const sources = { ...p.adpSources, espn: f.adp };
      return {
        ...p,
        name: f.name,
        position: f.position,
        team: f.team,
        adp: blendAdp(sources),
        adpSources: sources,
        projStats: f.projStats,
        lastStats: f.lastStats,
        projPoints: f.projPoints,
        injuryStatus: f.injuryStatus,
      };
    });

  const newcomers = fetched
    .filter((f) => !currentIds.has(f.id))
    .sort((a, b) => a.overallRank - b.overallRank);

  const list = updated.slice();
  for (const f of newcomers) {
    const idx = Math.min(Math.max(f.overallRank - 1, 0), list.length);
    list.splice(idx, 0, {
      id: f.id,
      name: f.name,
      position: f.position,
      team: f.team,
      overallRank: 0,
      byeWeek: null,
      tier: null, // normalizeTiers fills it from the player above
      adp: blendAdp({ espn: f.adp }),
      adpSources: { espn: f.adp },
      projStats: f.projStats,
      lastStats: f.lastStats,
      projPoints: f.projPoints,
      notes: "",
      flag: "none",
      draftStatus: "available",
      ...(f.injuryStatus ? { injuryStatus: f.injuryStatus } : {}),
    });
  }

  return normalizeTiers(reassignOverallRanks(list));
}

export async function fetchEspnPlayers(): Promise<FetchedPlayer[]> {
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
    throw new Error(`ESPN request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const raw: EspnEntry[] = Array.isArray(data.players) ? data.players : data;
  const shape = validateEspnShape(raw);
  if (!shape.ok) {
    console.warn("ESPN shape guard tripped:", shape.reason, shape.fingerprint);
    throw new EspnShapeError(shape.reason, shape.fingerprint);
  }
  const mapped = mapEspnPlayers(raw);
  if (mapped.length === 0) {
    throw new EspnShapeError("no-ranked", "mapped=0");
  }
  return mapped;
}

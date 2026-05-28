import type { Player, Position } from "../types";
import { normalizeTiers, reassignOverallRanks } from "./ranking";

const SEASON = 2026;
const LIMIT = 500; // ESPN ignores the filter's limit, so we cap here (matches seed)

export interface FetchedPlayer {
  id: string;
  name: string;
  position: Position;
  team: string;
  overallRank: number; // ESPN PPR rank, 1-based and contiguous
  adp: number | null;
  injuryStatus?: string;
}

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
}

// Mirror of scripts/fetch-espn.mjs: filter to ranked, known-position players,
// sort by PPR rank, and assign a contiguous 1-based overall rank.
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
      return {
        ...p,
        name: f.name,
        position: f.position,
        team: f.team,
        adp: f.adp,
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
      adp: f.adp,
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
  const mapped = mapEspnPlayers(raw);
  if (mapped.length === 0) {
    throw new Error("ESPN returned no ranked players.");
  }
  return mapped;
}

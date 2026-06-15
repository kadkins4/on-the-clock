import type { SleeperSource } from "./types";

// Shape of one Sleeper /projections/nfl/{season} row (fields we read).
export interface SleeperRaw {
  player_id?: string | number;
  stats?: Record<string, number> | null;
}

const n = (v: unknown): number | null => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

// Stat keys that are ADP/points rather than counting stats — pulled out into
// the structured fields, leaving `stats` as the raw projected stat line.
const NON_STAT = new Set([
  "adp_ppr",
  "adp_half_ppr",
  "adp_std",
  "adp_2qb",
  "adp_dynasty_ppr",
  "adp_rookie",
  "adp_dynasty",
  "adp_dynasty_2qb",
  "adp_dynasty_half_ppr",
  "adp_dynasty_std",
  "adp_idp",
  "pts_ppr",
  "pts_half_ppr",
  "pts_std",
]);

// Map Sleeper season projections, keyed by ESPN id via the FantasyCalc crosswalk.
// Rows whose sleeper id isn't in the crosswalk are skipped (no board join).
export function mapSleeperProjections(
  json: unknown,
  sleeperToEspn: Map<string, string>,
): Map<string, SleeperSource> {
  const out = new Map<string, SleeperSource>();
  if (!Array.isArray(json)) return out;

  for (const raw of json as SleeperRaw[]) {
    const sleeperId = raw.player_id == null ? "" : String(raw.player_id);
    const espnId = sleeperToEspn.get(sleeperId);
    if (!espnId || out.has(espnId)) continue;
    const s = raw.stats ?? {};

    const counting: Record<string, number> = {};
    for (const [k, v] of Object.entries(s)) {
      if (!NON_STAT.has(k) && Number.isFinite(v)) counting[k] = v;
    }

    out.set(espnId, {
      sleeperId,
      adp: {
        ppr: n(s.adp_ppr),
        halfPpr: n(s.adp_half_ppr),
        std: n(s.adp_std),
        twoQb: n(s.adp_2qb),
        dynastyPpr: n(s.adp_dynasty_ppr),
        rookie: n(s.adp_rookie),
      },
      proj: {
        ppr: n(s.pts_ppr),
        halfPpr: n(s.pts_half_ppr),
        std: n(s.pts_std),
      },
      gamesProjected: n(s.gp),
      stats: counting,
    });
  }
  return out;
}

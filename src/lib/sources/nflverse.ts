import type { NflverseSource } from "./types";
import { parseCsvRows } from "./csvRows";

const num = (v: string | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Parse nflverse's stats_player_reg_{season}.csv (regular-season totals, keyed
// by gsis player_id) and key it by espn id via the gsis→espn crosswalk. Rows
// whose gsis id isn't in the crosswalk are skipped (no board join).
export function mapNflverseStats(
  csvText: string,
  gsisToEspn: Map<string, string>,
): Map<string, NflverseSource> {
  const out = new Map<string, NflverseSource>();
  if (typeof csvText !== "string" || csvText.length === 0) return out;

  for (const row of parseCsvRows(csvText)) {
    const espnId = gsisToEspn.get(row.player_id);
    if (!espnId || out.has(espnId)) continue;
    out.set(espnId, {
      season: num(row.season) ?? 0,
      games: num(row.games),
      passYards: num(row.passing_yards),
      passTds: num(row.passing_tds),
      interceptions: num(row.passing_interceptions),
      passEpa: num(row.passing_epa),
      carries: num(row.carries),
      rushYards: num(row.rushing_yards),
      rushTds: num(row.rushing_tds),
      rushEpa: num(row.rushing_epa),
      targets: num(row.targets),
      receptions: num(row.receptions),
      recYards: num(row.receiving_yards),
      recTds: num(row.receiving_tds),
      recEpa: num(row.receiving_epa),
      targetShare: num(row.target_share),
      airYardsShare: num(row.air_yards_share),
      fantasyPointsPpr: num(row.fantasy_points_ppr),
    });
  }
  return out;
}

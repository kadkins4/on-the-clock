import type { NormalizedAdp } from "../ffcAdp";
import type { Position, Scoring } from "../../types";

const POS: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
};

const ADP_FIELD: Record<Scoring, string> = {
  ppr: "adp_ppr",
  half: "adp_half_ppr",
  standard: "adp_std",
};

interface SleeperProjRow {
  team?: string | null;
  player?: {
    first_name?: string | null;
    last_name?: string | null;
    position?: string | null;
    team?: string | null;
  };
  stats?: Record<string, number> | null;
}

// Sleeper uses ~999 for undrafted; anything at/over this isn't a real ADP.
const UNDRAFTED = 900;

// Map Sleeper season projections into NormalizedAdp for the board ADP blend,
// pulling the scoring-appropriate ADP field. Undrafted/sentinel rows are
// dropped. Backed by Sleeper's huge real-draft sample.
export function mapSleeperAdp(
  json: unknown,
  scoring: Scoring,
): NormalizedAdp[] {
  if (!Array.isArray(json)) return [];
  const field = ADP_FIELD[scoring];
  const out: NormalizedAdp[] = [];
  for (const r of json as SleeperProjRow[]) {
    const adp = r.stats?.[field];
    if (adp == null || adp <= 0 || adp >= UNDRAFTED) continue;
    const p = r.player;
    const position = p?.position ? POS[p.position] : undefined;
    if (!position) continue;
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
    if (!name) continue;
    const team = (r.team ?? p?.team ?? "").toUpperCase();
    out.push({ name, position, team, adp });
  }
  return out;
}

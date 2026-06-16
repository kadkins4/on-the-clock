import type { DraftInfo } from "./types";
import { parseCsvRows } from "./csvRows";

export interface DpEntry {
  espnId: string;
  name: string;
  position: string;
  team: string | null;
  birthdate: string | null;
  age: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  college: string | null;
  ids: {
    sleeper?: string;
    mfl?: string;
    fleaflicker?: string;
    gsis?: string;
    pfr?: string;
    fantasypros?: string;
  };
  draft: DraftInfo;
}

const num = (v: string | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const opt = (v: string | undefined): string | undefined =>
  v == null || v === "" ? undefined : v;
const nullable = (v: string | undefined): string | null =>
  v == null || v === "" ? null : v;

// Parse DynastyProcess's db_playerids.csv — a wide cross-platform id table. It's
// the most complete crosswalk we have (espn↔sleeper↔gsis + others) and carries
// draft pedigree + bio. Returns entries keyed by espn id plus sleeper→espn and
// gsis→espn maps (gsis is how nflverse season stats join the board).
export function mapDynastyIds(csvText: string): {
  byEspnId: Map<string, DpEntry>;
  sleeperToEspn: Map<string, string>;
  gsisToEspn: Map<string, string>;
} {
  const byEspnId = new Map<string, DpEntry>();
  const sleeperToEspn = new Map<string, string>();
  const gsisToEspn = new Map<string, string>();
  if (typeof csvText !== "string" || csvText.length === 0)
    return { byEspnId, sleeperToEspn, gsisToEspn };

  for (const row of parseCsvRows(csvText)) {
    const espnId = opt(row.espn_id);
    if (!espnId || byEspnId.has(espnId)) continue;
    const sleeperId = opt(row.sleeper_id);
    const gsisId = opt(row.gsis_id);
    if (sleeperId && !sleeperToEspn.has(sleeperId))
      sleeperToEspn.set(sleeperId, espnId);
    if (gsisId && !gsisToEspn.has(gsisId)) gsisToEspn.set(gsisId, espnId);

    byEspnId.set(espnId, {
      espnId,
      name: row.name ?? "",
      position: row.position ?? "",
      team: nullable(row.team),
      birthdate: nullable(row.birthdate),
      age: num(row.age),
      heightInches: num(row.height),
      weightLbs: num(row.weight),
      college: nullable(row.college),
      ids: {
        sleeper: sleeperId,
        mfl: opt(row.mfl_id),
        fleaflicker: opt(row.fleaflicker_id),
        gsis: gsisId,
        pfr: opt(row.pfr_id),
        fantasypros: opt(row.fantasypros_id),
      },
      draft: {
        year: num(row.draft_year),
        round: num(row.draft_round),
        pick: num(row.draft_pick),
        overall: num(row.draft_ovr),
      },
    });
  }
  return { byEspnId, sleeperToEspn, gsisToEspn };
}

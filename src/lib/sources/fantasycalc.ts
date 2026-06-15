import type { FantasyCalcSource } from "./types";

// Shape of one FantasyCalc /values/current row (only the fields we read).
export interface FcRaw {
  player?: {
    id?: number;
    name?: string;
    position?: string;
    espnId?: string | number | null;
    sleeperId?: string | number | null;
    mflId?: string | number | null;
    fleaflickerId?: string | number | null;
    ffpcId?: string | number | null;
    maybeTeam?: string | null;
    maybeAge?: number | null;
    maybeHeight?: string | number | null;
    maybeWeight?: string | number | null;
    maybeCollege?: string | null;
    maybeYoe?: number | null;
  };
  value?: number | null;
  redraftValue?: number | null;
  overallRank?: number | null;
  positionRank?: number | null;
  maybeAdp?: number | null;
  trend30Day?: number | null;
  maybeTier?: number | null;
}

export interface FcRow {
  espnId: string;
  name: string;
  position: string;
  ids: { sleeper?: string; mfl?: string; fleaflicker?: string; ffpc?: string };
  fantasycalc: FantasyCalcSource;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: string | number | null | undefined): string | undefined =>
  v == null || v === "" ? undefined : String(v);

// Map FantasyCalc rows into ESPN-id-keyed entries plus a sleeper→espn crosswalk.
// Rows without an espnId are skipped — we can't join them to our board.
export function mapFantasyCalc(json: unknown): {
  byEspnId: Map<string, FcRow>;
  sleeperToEspn: Map<string, string>;
} {
  const byEspnId = new Map<string, FcRow>();
  const sleeperToEspn = new Map<string, string>();
  if (!Array.isArray(json)) return { byEspnId, sleeperToEspn };

  for (const raw of json as FcRaw[]) {
    const p = raw.player;
    const espnId = str(p?.espnId);
    if (!p || !espnId || byEspnId.has(espnId)) continue;
    const sleeperId = str(p.sleeperId);
    if (sleeperId) sleeperToEspn.set(sleeperId, espnId);

    byEspnId.set(espnId, {
      espnId,
      name: p.name ?? "",
      position: p.position ?? "",
      ids: {
        sleeper: sleeperId,
        mfl: str(p.mflId),
        fleaflicker: str(p.fleaflickerId),
        ffpc: str(p.ffpcId),
      },
      fantasycalc: {
        id: Number(p.id ?? 0),
        value: num(raw.value),
        redraftValue: num(raw.redraftValue),
        overallRank: num(raw.overallRank),
        positionRank: num(raw.positionRank),
        adp: num(raw.maybeAdp),
        trend30Day: num(raw.trend30Day),
        tier: num(raw.maybeTier),
        team: str(p.maybeTeam) ?? null,
        age: num(p.maybeAge),
        heightInches: num(p.maybeHeight),
        weightLbs: num(p.maybeWeight),
        college: str(p.maybeCollege) ?? null,
        yearsExp: num(p.maybeYoe),
      },
    });
  }
  return { byEspnId, sleeperToEspn };
}

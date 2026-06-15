import type { PlayerBio } from "./types";

// One entry of Sleeper's /v1/players/nfl map (the fields we read).
export interface SleeperPlayerRaw {
  espn_id?: string | number | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  team?: string | null;
  age?: number | null;
  college?: string | null;
  height?: string | number | null;
  weight?: string | number | null;
  years_exp?: number | null;
  number?: string | number | null;
  status?: string | null;
  injury_status?: string | null;
  depth_chart_position?: string | null;
}

export interface SleeperPlayerEntry {
  sleeperId: string;
  name: string;
  position: string;
  bio: PlayerBio;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: string | number | null | undefined): string | null =>
  v == null || v === "" ? null : String(v);

// Map Sleeper's player map. Returns bio keyed by sleeper id (always present),
// plus a sleeper→espn crosswalk for the players that carry an espn_id. Sleeper's
// espn_id is missing for many stars (e.g. Bijan Robinson), so this crosswalk is
// merged with FantasyCalc's (which is reliable for its top 200) in buildSources.
export function mapSleeperPlayers(json: unknown): {
  bySleeperId: Map<string, SleeperPlayerEntry>;
  sleeperToEspn: Map<string, string>;
} {
  const bySleeperId = new Map<string, SleeperPlayerEntry>();
  const sleeperToEspn = new Map<string, string>();
  if (!json || typeof json !== "object") return { bySleeperId, sleeperToEspn };

  for (const [sleeperId, raw] of Object.entries(
    json as Record<string, SleeperPlayerRaw>,
  )) {
    if (!raw) continue;
    const espnId = str(raw.espn_id);
    if (espnId && !sleeperToEspn.has(sleeperId))
      sleeperToEspn.set(sleeperId, espnId);

    const name =
      str(raw.full_name) ??
      [raw.first_name, raw.last_name].filter(Boolean).join(" ").trim();
    bySleeperId.set(sleeperId, {
      sleeperId,
      name: name || "",
      position: raw.position ?? "",
      bio: {
        team: str(raw.team),
        age: num(raw.age),
        college: str(raw.college),
        heightInches: num(raw.height),
        weightLbs: num(raw.weight),
        yearsExp: num(raw.years_exp),
        jersey: num(raw.number),
        status: str(raw.status),
        injuryStatus: str(raw.injury_status),
        depthChartPos: str(raw.depth_chart_position),
      },
    });
  }
  return { bySleeperId, sleeperToEspn };
}

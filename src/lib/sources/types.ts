// Normalized third-party player data, gathered from free no-key feeds (Sleeper,
// FantasyCalc) and keyed by ESPN id — the same id our board uses (Player.id).
// This is a side store: it is NOT folded into the board/ranking model. It's a
// rich payload we collect now and surface later (e.g. a player info card).
//
// FantasyCalc is the crosswalk hub: each of its rows carries espnId + sleeperId,
// which lets us join Sleeper's (sleeper-id-keyed) projections onto our ESPN
// board without fuzzy name matching.

export interface SleeperSource {
  sleeperId: string;
  // Average draft position by format (Sleeper publishes several).
  adp: {
    ppr: number | null;
    halfPpr: number | null;
    std: number | null;
    twoQb: number | null;
    dynastyPpr: number | null;
    rookie: number | null;
  };
  // Projected fantasy points by scoring.
  proj: {
    ppr: number | null;
    halfPpr: number | null;
    std: number | null;
  };
  gamesProjected: number | null;
  // Raw projected stat line (rush_yd, rec, rec_td, pass_yd, …) as Sleeper sends
  // it — kept verbatim so the future card can pick whatever it wants.
  stats: Record<string, number>;
}

export interface FantasyCalcSource {
  id: number;
  value: number | null; // dynasty/combined market value
  redraftValue: number | null;
  overallRank: number | null;
  positionRank: number | null;
  adp: number | null;
  trend30Day: number | null;
  tier: number | null;
  // Bio
  team: string | null;
  age: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  college: string | null;
  yearsExp: number | null;
}

// Bio / status, sourced from the Sleeper player map (covers the full roster,
// not just the FantasyCalc top 200).
export interface PlayerBio {
  team: string | null;
  age: number | null;
  college: string | null;
  heightInches: number | null;
  weightLbs: number | null;
  yearsExp: number | null;
  jersey: number | null;
  status: string | null; // e.g. "Active", "Inactive"
  injuryStatus: string | null; // e.g. "Questionable", "Out", "IR"
  depthChartPos: string | null;
}

export interface PlayerSourceData {
  espnId: string; // canonical key — matches Player.id on the board
  name: string;
  position: string;
  // Cross-platform ids for joining future sources.
  ids: {
    sleeper?: string;
    mfl?: string;
    fleaflicker?: string;
    ffpc?: string;
  };
  bio?: PlayerBio;
  fantasycalc?: FantasyCalcSource;
  sleeper?: SleeperSource;
}

export type SourcesStore = Record<string, PlayerSourceData>; // keyed by espnId

export interface SourcesMeta {
  count: number;
  sources: string[]; // which feeds contributed, e.g. ["fantasycalc", "sleeper"]
  season: number;
  error?: string;
}

export interface SourcesResponse {
  sources: SourcesStore;
  meta: SourcesMeta;
}

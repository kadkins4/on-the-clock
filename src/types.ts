import type { ColumnLayout } from "./lib/columnLayout";

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
export type Flag = "none" | "target" | "avoid";
export type SortKey =
  | "overall"
  | "adp"
  | "name"
  | "bye"
  | "vor"
  | "pos"
  | "proj"
  | "last";
export type DraftStatus = "available" | "mine" | "taken";

export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export interface Player {
  id: string; // ESPN id for seeded rows, uuid for new
  name: string;
  position: Position;
  team: string; // abbreviation, "FA" if none
  overallRank: number; // 1-based, derived from list order
  byeWeek: number | null;
  tier: number | null; // null = "Untiered" group
  adp: number | null; // blended (mean of available sources); board sorts on this
  adpSources?: {
    espn?: number | null;
    ffc?: number | null;
    fantasypros?: number | null;
    yahoo?: number | null;
    sleeper?: number | null;
  };
  // Raw projected stat line (offensive players only) — scored at the league's
  // settings to produce projected points for VOR. K/DST have no line.
  projStats?: ProjStats | null;
  // Raw last-season ACTUAL stat line (offensive players); same shape as
  // projStats, scored by the same core. Absent for K/DST, rookies, unmatched.
  lastStats?: ProjStats | null;
  // ESPN's own precomputed projected total. Sparse today; used as the fallback
  // for K/DST (and anyone without a raw line) so VOR fills in nearer the season.
  projPoints?: number | null;
  notes: string;
  flag: Flag;
  draftStatus: DraftStatus;
  injuryStatus?: string; // raw ESPN value, present only when not ACTIVE
  // Bio, baked from Sleeper's player map (see scripts/enrich-bio.mjs). Sparse
  // for players Sleeper doesn't carry; drives age/experience-based bot
  // personalities and the future player-detail panel.
  age?: number | null;
  yearsExp?: number | null; // 0 = rookie
}

// Fantasy-relevant projected stats pulled from ESPN's raw projection line.
// Scored by src/lib/projection.ts to get projected points under a league's rules.
export interface ProjStats {
  passYds: number;
  passTD: number;
  int: number;
  rushYds: number;
  rushTD: number;
  rec: number;
  recYds: number;
  recTD: number;
  fumblesLost: number;
  twoPt: number; // sum of pass/rush/rec 2-pt conversions (ESPN ids 19/26/44)
}

export type Scoring = "ppr" | "half" | "standard";
export type Platform = "espn" | "yahoo" | "sleeper" | "underdog" | "other";

export interface RosterSettings {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  SUPERFLEX: number;
  K: number;
  DST: number;
  bench: number;
  disabled: Position[]; // positions removed from this league entirely
}

// A tier boundary. `above` = how many players sit above this break in the
// overall-rank ordering. Sorted by `above`; duplicates = an empty tier. The
// stable `id` keeps duplicate breaks distinct and is the dnd-kit sortable id.
export interface Break {
  id: string;
  above: number;
}

// A named ranking within a league. A league owns several (e.g. "Balanced",
// "RB-heavy"); ids are stable so renaming can't orphan active/default pointers.
export interface TierList {
  id: string;
  name: string;
  board: Player[];
  breaks?: Break[]; // tier boundaries; source of truth. Absent => derive from tier.
  // Reach/value cue config for this list. Absent => enabled, auto threshold.
  valueFlags?: { enabled: boolean; threshold: number | null };
}

export interface League {
  id: string;
  name: string;
  platform: Platform;
  scoring: Scoring;
  tePremium: boolean;
  teams: number; // 8–16
  roster: RosterSettings;
  tierLists: TierList[]; // replaces the old single `board`
  activeTierListId: string; // the list the board view shows/edits
  defaultTierListId: string; // marked "default"; a mock starts from this
  columnsOverride?: ColumnLayout | null; // null/absent = inherit global layout
  updatedAt: number; // epoch ms; used by a later sync plan
}

export interface LeaguesState {
  currentId: string;
  leagues: League[]; // insertion-ordered
}

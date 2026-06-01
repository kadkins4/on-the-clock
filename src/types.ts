export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
export type Flag = "none" | "target" | "avoid";
export type SortKey = "overall" | "adp" | "name" | "bye";
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
  adpSources?: { espn?: number | null; ffc?: number | null };
  notes: string;
  flag: Flag;
  draftStatus: DraftStatus;
  injuryStatus?: string; // raw ESPN value, present only when not ACTIVE
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

export interface League {
  id: string;
  name: string;
  platform: Platform;
  scoring: Scoring;
  tePremium: boolean;
  teams: number; // 8–16
  roster: RosterSettings;
  board: Player[];
  updatedAt: number; // epoch ms; used by a later sync plan
}

export interface LeaguesState {
  currentId: string;
  leagues: League[]; // insertion-ordered
}

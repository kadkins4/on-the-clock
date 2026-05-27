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
  adp: number | null;
  notes: string;
  flag: Flag;
  draftStatus: DraftStatus;
  injuryStatus?: string; // raw ESPN value, present only when not ACTIVE
}

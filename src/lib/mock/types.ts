import type { Player, RosterSettings, Scoring } from "../../types";
import type { TeamIdentity } from "./teamIdentity";

export interface MockSettings {
  teams: number; // 8–16
  userSlot: number; // 1-based draft position
  rounds: number; // total roster size (starters + bench)
  thirdRoundReversal: boolean;
  // resolved reach/value config for the mock (from the seeding list). Optional
  // so existing fixtures keep working; read sites default threshold to teams+2.
  valueThreshold?: number;
  valueFlagsEnabled?: boolean;
  autoDraft?: boolean;
}

export interface DraftPick {
  overall: number; // 1-based overall pick number
  round: number; // 1-based
  teamIndex: number; // 0-based team
  playerId: string;
}

export interface MockState {
  // immutable snapshot of the league at draft start
  pool: Player[]; // all draftable players (disabled positions removed)
  scoring: Scoring;
  roster: RosterSettings;
  settings: MockSettings;
  teams: TeamIdentity[]; // generated team identities (name/avatar/isUser)
  order: number[]; // order[i] = teamIndex picking at overall pick (i+1)
  picks: DraftPick[]; // in pick order
  draftedIds: Set<string>;
  // RNG state is carried as a numeric seed advanced per bot pick (pure)
  seed: number;
}

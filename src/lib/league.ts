import type {
  League,
  LeaguesState,
  Platform,
  Player,
  RosterSettings,
  Scoring,
  TierList,
} from "../types";
import type { Board } from "../state/reducer";
import { defaultValueThreshold } from "./draftValue";

// --- Tier-list accessors ----------------------------------------------------
// Each falls back to the first list if the stored id has gone missing, so a
// stale/corrupt active/default pointer can never leave the league boardless.

export function activeTierList(l: League): TierList {
  return l.tierLists.find((t) => t.id === l.activeTierListId) ?? l.tierLists[0];
}

export function activeBoard(l: League): Player[] {
  return activeTierList(l).board;
}

export function defaultBoard(l: League): Player[] {
  return (
    l.tierLists.find((t) => t.id === l.defaultTierListId) ?? l.tierLists[0]
  ).board;
}

export function defaultRoster(): RosterSettings {
  return {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    SUPERFLEX: 0,
    K: 1,
    DST: 1,
    bench: 6,
    disabled: [],
  };
}

export function makeLeague(opts: {
  name: string;
  board?: Player[];
  scoring?: Scoring;
  platform?: Platform;
  teams?: number;
}): League {
  const listId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    name: opts.name,
    platform: opts.platform ?? "other",
    scoring: opts.scoring ?? "ppr",
    tePremium: false,
    teams: opts.teams ?? 12,
    roster: defaultRoster(),
    tierLists: [{ id: listId, name: "Default", board: opts.board ?? [] }],
    activeTierListId: listId,
    defaultTierListId: listId,
    updatedAt: Date.now(),
  };
}

// Reach/value threshold for a list: explicit override, else the default.
export function valueThreshold(league: League, list: TierList): number {
  return list.valueFlags?.threshold ?? defaultValueThreshold(league.teams);
}

export function valueFlagsEnabled(list: TierList): boolean {
  return list.valueFlags?.enabled ?? true;
}

export function migrateBoardToLeagues(board: Board): LeaguesState {
  const leagues = Object.keys(board.lists).map((name) =>
    makeLeague({ name, board: board.lists[name] }),
  );
  const current = leagues.find((l) => l.name === board.current) ?? leagues[0];
  return { currentId: current.id, leagues };
}

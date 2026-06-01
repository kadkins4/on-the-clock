import type {
  League,
  LeaguesState,
  Platform,
  Player,
  RosterSettings,
  Scoring,
} from "../types";
import type { Board } from "../state/reducer";

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
  return {
    id: crypto.randomUUID(),
    name: opts.name,
    platform: opts.platform ?? "other",
    scoring: opts.scoring ?? "ppr",
    tePremium: false,
    teams: opts.teams ?? 12,
    roster: defaultRoster(),
    board: opts.board ?? [],
    updatedAt: Date.now(),
  };
}

export function migrateBoardToLeagues(board: Board): LeaguesState {
  const leagues = Object.keys(board.lists).map((name) =>
    makeLeague({ name, board: board.lists[name] }),
  );
  const current = leagues.find((l) => l.name === board.current) ?? leagues[0];
  return { currentId: current.id, leagues };
}

import type { League, LeaguesState, Player } from "../types";
import { makeLeague } from "../lib/league";
import {
  reassignOverallRanks,
  moveAndRetier,
  normalizeTiers,
  moveTier,
  splitTierAt,
  removeTier,
  moveIntoNewTier,
} from "../lib/ranking";
import { mergeFetched, type FetchedPlayer } from "../lib/fetchEspn";
import { withByeWeeks } from "../lib/byes";

export type Action =
  | { type: "setAll"; players: Player[] }
  | { type: "add"; player: Player }
  | {
      type: "update";
      id: string;
      patch: Partial<Omit<Player, "id" | "overallRank">>;
    }
  | { type: "remove"; id: string }
  | { type: "move"; activeId: string; overId: string }
  | { type: "moveTier"; fromTier: number; toTier: number }
  | { type: "splitTier"; playerId: string }
  | { type: "removeTier"; tier: number }
  | { type: "moveIntoNewTier"; playerId: string; beforeId: string | null }
  | { type: "merge"; fetched: FetchedPlayer[] };

export function rankingReducer(state: Player[], action: Action): Player[] {
  switch (action.type) {
    case "setAll": {
      // normalize gapped/unsorted external ranks into contiguous 1-based order,
      // and ensure every player has a tier (no "Untiered" group).
      const sorted = action.players
        .slice()
        .sort((a, b) => a.overallRank - b.overallRank);
      return normalizeTiers(withByeWeeks(reassignOverallRanks(sorted)));
    }
    case "add":
      return normalizeTiers(reassignOverallRanks([...state, action.player]));
    case "update":
      return state.map((p) =>
        p.id === action.id ? { ...p, ...action.patch } : p,
      );
    case "remove":
      return reassignOverallRanks(state.filter((p) => p.id !== action.id));
    case "move":
      return moveAndRetier(state, action.activeId, action.overId);
    case "moveTier":
      return moveTier(state, action.fromTier, action.toTier);
    case "splitTier":
      return splitTierAt(state, action.playerId);
    case "removeTier":
      return removeTier(state, action.tier);
    case "moveIntoNewTier":
      return moveIntoNewTier(state, action.playerId, action.beforeId);
    case "merge":
      return withByeWeeks(mergeFetched(state, action.fetched));
    default:
      return state;
  }
}

// --- Named lists ------------------------------------------------------------
// The board holds several named player lists (e.g. PPR, Dynasty) and which one
// is active. Player actions apply to the active list; list actions manage them.

export interface Board {
  current: string;
  lists: Record<string, Player[]>;
}

export type ListAction =
  | { type: "switchList"; name: string }
  | { type: "saveListAs"; name: string }
  | { type: "deleteList"; name: string }
  | { type: "renameList"; name: string };

function normalize(players: Player[]): Player[] {
  return normalizeTiers(withByeWeeks(players));
}

export function boardReducer(board: Board, action: Action | ListAction): Board {
  switch (action.type) {
    case "switchList": {
      if (!board.lists[action.name] || action.name === board.current)
        return board;
      return {
        current: action.name,
        lists: {
          ...board.lists,
          [action.name]: normalize(board.lists[action.name]),
        },
      };
    }
    case "saveListAs": {
      const name = action.name.trim();
      if (!name) return board;
      return {
        current: name,
        lists: { ...board.lists, [name]: board.lists[board.current] },
      };
    }
    case "deleteList": {
      if (!board.lists[action.name] || Object.keys(board.lists).length <= 1)
        return board;
      const lists = { ...board.lists };
      delete lists[action.name];
      const current =
        action.name === board.current ? Object.keys(lists)[0] : board.current;
      return {
        current,
        lists: { ...lists, [current]: normalize(lists[current]) },
      };
    }
    case "renameList": {
      const to = action.name.trim();
      const from = board.current;
      if (!to || to === from || board.lists[to]) return board;
      const lists: Record<string, Player[]> = {};
      // preserve insertion order, swapping the current name for the new one
      for (const [k, v] of Object.entries(board.lists)) {
        lists[k === from ? to : k] = v;
      }
      return { current: to, lists };
    }
    default: {
      const players = rankingReducer(board.lists[board.current], action);
      return {
        ...board,
        lists: { ...board.lists, [board.current]: players },
      };
    }
  }
}

// --- Leagues ----------------------------------------------------------------
// A league is a player board plus its settings (scoring, teams, roster). Player
// and tier actions delegate to rankingReducer on the active league's board;
// league actions manage the league list and per-league settings.

export type LeagueAction =
  | { type: "switchLeague"; id: string }
  | { type: "addLeague"; name: string }
  | { type: "deleteLeague"; id: string }
  | { type: "renameLeague"; id: string; name: string }
  | {
      type: "updateLeagueSettings";
      id: string;
      patch: Partial<
        Pick<League, "platform" | "scoring" | "tePremium" | "teams" | "roster">
      >;
    };

function mapLeague(
  state: LeaguesState,
  id: string,
  fn: (l: League) => League,
): LeaguesState {
  return {
    ...state,
    leagues: state.leagues.map((l) => (l.id === id ? fn(l) : l)),
  };
}

export function leaguesReducer(
  state: LeaguesState,
  action: Action | LeagueAction,
): LeaguesState {
  switch (action.type) {
    case "switchLeague":
      if (!state.leagues.some((l) => l.id === action.id)) return state;
      return { ...state, currentId: action.id };
    case "addLeague": {
      const name = action.name.trim();
      if (!name) return state;
      const lg = makeLeague({ name });
      return { currentId: lg.id, leagues: [...state.leagues, lg] };
    }
    case "deleteLeague": {
      if (state.leagues.length <= 1) return state;
      const leagues = state.leagues.filter((l) => l.id !== action.id);
      const currentId =
        action.id === state.currentId ? leagues[0].id : state.currentId;
      return { currentId, leagues };
    }
    case "renameLeague": {
      const name = action.name.trim();
      if (!name) return state;
      return mapLeague(state, action.id, (l) => ({ ...l, name }));
    }
    case "updateLeagueSettings":
      return mapLeague(state, action.id, (l) => ({ ...l, ...action.patch }));
    default: {
      // a player/tier Action — delegate to the active league's board
      return mapLeague(state, state.currentId, (l) => ({
        ...l,
        board: rankingReducer(l.board, action),
        updatedAt: Date.now(),
      }));
    }
  }
}

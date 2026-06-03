import type { League, LeaguesState, Player } from "../types";
import type { ColumnLayout } from "../lib/columnLayout";
import { makeLeague, activeTierList } from "../lib/league";
import {
  reassignOverallRanks,
  moveAndRetier,
  normalizeTiers,
  moveTier,
  splitTierAt,
  removeTier,
  moveIntoNewTier,
  orderByAdp,
} from "../lib/ranking";
import seed from "../data/seed.json";
import { mergeFetched, type FetchedPlayer } from "../lib/fetchEspn";
import { applyFfcAdp } from "../lib/blendAdp";
import type { NormalizedAdp } from "../lib/ffcAdp";
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
  | { type: "merge"; fetched: FetchedPlayer[] }
  | { type: "applyAdp"; ffc: NormalizedAdp[] };

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
    case "applyAdp":
      return applyFfcAdp(state, action.ffc);
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

function normalize(players: Player[]): Player[] {
  return normalizeTiers(withByeWeeks(players));
}

// --- Leagues ----------------------------------------------------------------
// A league is a player board plus its settings (scoring, teams, roster). Player
// and tier actions delegate to rankingReducer on the active league's board;
// league actions manage the league list and per-league settings.

export type LeagueAction =
  | { type: "switchLeague"; id: string }
  | { type: "addLeague"; name: string }
  | { type: "duplicateLeague"; id: string; name: string }
  | { type: "deleteLeague"; id: string }
  | { type: "renameLeague"; id: string; name: string }
  // Replace the whole state from the source of truth (a "refresh"). Today that
  // source is storage; later it'll be a DB sync.
  | { type: "setLeagues"; state: LeaguesState }
  | {
      type: "updateLeagueSettings";
      id: string;
      patch: Partial<
        Pick<League, "platform" | "scoring" | "tePremium" | "teams" | "roster">
      >;
    }
  | { type: "setLeagueColumns"; id: string; layout: ColumnLayout | null };

// Tier-list actions operate on the *current* league's tier lists. switch/delete/
// setDefault take a list id; add/duplicate/rename act on the active list.
export type TierListAction =
  | { type: "switchTierList"; id: string }
  | { type: "addTierList"; name: string }
  | { type: "duplicateTierList"; name: string }
  | { type: "renameTierList"; name: string }
  | { type: "deleteTierList"; id: string }
  | { type: "setDefaultTierList"; id: string }
  | {
      type: "setListValueFlags";
      listId: string;
      valueFlags: { enabled: boolean; threshold: number | null };
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

// Re-derive tiers + bye weeks on the active tier list's board. Only the active
// league/list is normalized eagerly, so we run this on switch.
function normalizeActiveList(l: League): League {
  const activeId = activeTierList(l).id;
  return {
    ...l,
    tierLists: l.tierLists.map((t) =>
      t.id === activeId ? { ...t, board: normalize(t.board) } : t,
    ),
  };
}

export function leaguesReducer(
  state: LeaguesState,
  action: Action | LeagueAction | TierListAction,
): LeaguesState {
  switch (action.type) {
    case "setLeagues":
      return action.state;
    case "switchLeague": {
      if (!state.leagues.some((l) => l.id === action.id)) return state;
      // Normalize the target's active list on switch (tiers + bye weeks), since
      // only the current league is normalized at load time.
      return mapLeague({ ...state, currentId: action.id }, action.id, (l) =>
        normalizeActiveList(l),
      );
    }
    case "addLeague": {
      const name = action.name.trim();
      if (!name) return state;
      const lg = makeLeague({ name });
      return { currentId: lg.id, leagues: [...state.leagues, lg] };
    }
    case "duplicateLeague": {
      const name = action.name.trim();
      const src = state.leagues.find((l) => l.id === action.id);
      if (!name || !src) return state;
      // Clone every tier list with fresh ids (so the copy is fully independent),
      // remapping the active/default pointers onto the new ids.
      const idMap = new Map<string, string>();
      const tierLists = src.tierLists.map((t) => {
        const id = crypto.randomUUID();
        idMap.set(t.id, id);
        return {
          id,
          name: t.name,
          board: t.board.map((p) => ({ ...p })),
          valueFlags: t.valueFlags,
        };
      });
      const lg: League = {
        ...makeLeague({
          name,
          scoring: src.scoring,
          platform: src.platform,
          teams: src.teams,
        }),
        roster: { ...src.roster, disabled: [...src.roster.disabled] },
        tePremium: src.tePremium,
        tierLists,
        activeTierListId: idMap.get(src.activeTierListId) ?? tierLists[0].id,
        defaultTierListId: idMap.get(src.defaultTierListId) ?? tierLists[0].id,
      };
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

    case "setLeagueColumns":
      return mapLeague(state, action.id, (l) => ({
        ...l,
        columnsOverride: action.layout,
      }));

    case "switchTierList": {
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!current || !current.tierLists.some((t) => t.id === action.id))
        return state;
      return mapLeague(state, current.id, (l) =>
        normalizeActiveList({ ...l, activeTierListId: action.id }),
      );
    }
    case "addTierList": {
      const name = action.name.trim();
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!name || !current) return state;
      const id = crypto.randomUUID();
      const board = normalize(orderByAdp(seed as unknown as Player[]));
      return mapLeague(state, current.id, (l) => ({
        ...l,
        tierLists: [...l.tierLists, { id, name, board }],
        activeTierListId: id,
      }));
    }
    case "duplicateTierList": {
      const name = action.name.trim();
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!name || !current) return state;
      const id = crypto.randomUUID();
      const source = activeTierList(current);
      const board = source.board.map((p) => ({ ...p }));
      return mapLeague(state, current.id, (l) => ({
        ...l,
        tierLists: [
          ...l.tierLists,
          { id, name, board, valueFlags: source.valueFlags },
        ],
        activeTierListId: id,
      }));
    }
    case "renameTierList": {
      const name = action.name.trim();
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!name || !current) return state;
      const activeId = current.activeTierListId;
      return mapLeague(state, current.id, (l) => ({
        ...l,
        tierLists: l.tierLists.map((t) =>
          t.id === activeId ? { ...t, name } : t,
        ),
      }));
    }
    case "deleteTierList": {
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!current || current.tierLists.length <= 1) return state;
      if (!current.tierLists.some((t) => t.id === action.id)) return state;
      const tierLists = current.tierLists.filter((t) => t.id !== action.id);
      const activeTierListId =
        action.id === current.activeTierListId
          ? tierLists[0].id
          : current.activeTierListId;
      const defaultTierListId =
        action.id === current.defaultTierListId
          ? tierLists[0].id
          : current.defaultTierListId;
      return mapLeague(state, current.id, (l) =>
        normalizeActiveList({
          ...l,
          tierLists,
          activeTierListId,
          defaultTierListId,
        }),
      );
    }
    case "setDefaultTierList": {
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!current || !current.tierLists.some((t) => t.id === action.id))
        return state;
      return mapLeague(state, current.id, (l) => ({
        ...l,
        defaultTierListId: action.id,
      }));
    }
    case "setListValueFlags": {
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!current) return state;
      return mapLeague(state, current.id, (l) => ({
        ...l,
        tierLists: l.tierLists.map((t) =>
          t.id === action.listId ? { ...t, valueFlags: action.valueFlags } : t,
        ),
      }));
    }

    default: {
      // a player/tier Action — delegate to the current league's ACTIVE list.
      // Skip the update (and the updatedAt bump) when the board is unchanged.
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!current) return state;
      const active = activeTierList(current);
      const board = rankingReducer(active.board, action);
      if (board === active.board) return state;
      return mapLeague(state, state.currentId, (l) => ({
        ...l,
        tierLists: l.tierLists.map((t) =>
          t.id === active.id ? { ...t, board } : t,
        ),
        updatedAt: Date.now(),
      }));
    }
  }
}

import type { Player } from "../types";
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

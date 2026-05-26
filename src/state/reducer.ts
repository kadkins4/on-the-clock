import type { Player } from "../types";
import { reassignOverallRanks, moveAndRetier } from "../lib/ranking";

export type Action =
  | { type: "setAll"; players: Player[] }
  | { type: "add"; player: Player }
  | {
      type: "update";
      id: string;
      patch: Partial<Omit<Player, "id" | "overallRank">>;
    }
  | { type: "remove"; id: string }
  | { type: "toggleDrafted"; id: string }
  | { type: "move"; activeId: string; overId: string };

export function rankingReducer(state: Player[], action: Action): Player[] {
  switch (action.type) {
    case "setAll": {
      // normalize potentially gapped/unsorted external ranks into contiguous 1-based order
      const sorted = action.players
        .slice()
        .sort((a, b) => a.overallRank - b.overallRank);
      return reassignOverallRanks(sorted);
    }
    case "add":
      return reassignOverallRanks([...state, action.player]);
    case "update":
      return state.map((p) =>
        p.id === action.id ? { ...p, ...action.patch } : p,
      );
    case "remove":
      return reassignOverallRanks(state.filter((p) => p.id !== action.id));
    case "toggleDrafted":
      return state.map((p) =>
        p.id === action.id ? { ...p, drafted: !p.drafted } : p,
      );
    case "move":
      return moveAndRetier(state, action.activeId, action.overId);
    default:
      return state;
  }
}

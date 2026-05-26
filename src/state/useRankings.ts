import { useEffect, useReducer } from "react";
import { rankingReducer } from "./reducer";
import { loadPlayers, savePlayers } from "../lib/storage";

export function useRankings() {
  const [players, dispatch] = useReducer(
    rankingReducer,
    undefined,
    loadPlayers,
  );
  useEffect(() => {
    savePlayers(players);
  }, [players]);
  return { players, dispatch };
}

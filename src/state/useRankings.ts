import { useEffect, useReducer } from "react";
import { leaguesReducer } from "./reducer";
import { loadLeagues, saveLeagues } from "../lib/storage";

export function useRankings() {
  const [state, dispatch] = useReducer(leaguesReducer, undefined, loadLeagues);
  useEffect(() => {
    saveLeagues(state);
  }, [state]);
  const current =
    state.leagues.find((l) => l.id === state.currentId) ?? state.leagues[0];
  return {
    players: current.board,
    dispatch,
    currentLeague: current,
    leagues: state.leagues,
  };
}

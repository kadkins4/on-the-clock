import { useEffect, useMemo, useReducer } from "react";
import { leaguesReducer } from "./reducer";
import { loadLeagues, saveLeagues } from "../lib/storage";
import { activeBoard } from "../lib/league";
import { computeVor } from "../lib/vor";
import { projectedPoints, lastSeasonPoints } from "../lib/projection";

export function useRankings() {
  const [state, dispatch] = useReducer(leaguesReducer, undefined, loadLeagues);
  useEffect(() => {
    saveLeagues(state);
  }, [state]);
  const current =
    state.leagues.find((l) => l.id === state.currentId) ?? state.leagues[0];
  const players = activeBoard(current);
  const vorById = useMemo(
    () =>
      computeVor(
        players,
        current.roster,
        current.teams,
        current.scoring,
        current.tePremium,
      ),
    [
      players,
      current.roster,
      current.teams,
      current.scoring,
      current.tePremium,
    ],
  );
  // Per-id scored maps for the Proj + last-season columns; same scorer, so they
  // re-score in lockstep with scoring/TE-premium changes.
  const projById = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const p of players)
      m[p.id] = projectedPoints(p, current.scoring, current.tePremium);
    return m;
  }, [players, current.scoring, current.tePremium]);
  const lastById = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const p of players)
      m[p.id] = lastSeasonPoints(p, current.scoring, current.tePremium);
    return m;
  }, [players, current.scoring, current.tePremium]);
  // Re-load league data from the source of truth (storage today; a DB sync
  // later). Mock-draft and UI filter state live elsewhere, so they're untouched.
  const refresh = () => dispatch({ type: "setLeagues", state: loadLeagues() });
  return {
    players,
    vorById,
    projById,
    lastById,
    dispatch,
    refresh,
    currentLeague: current,
    leagues: state.leagues,
    tierLists: current.tierLists.map(({ id, name }) => ({ id, name })),
    activeTierListId: current.activeTierListId,
    defaultTierListId: current.defaultTierListId,
  };
}

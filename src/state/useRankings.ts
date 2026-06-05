import { useEffect, useMemo, useReducer } from "react";
import { leaguesReducer } from "./reducer";
import type { Action, LeagueAction, TierListAction } from "./reducer";
import { withHistory } from "./undoable";
import type { LeaguesState } from "../types";
import { loadLeagues, saveLeagues } from "../lib/storage";
import { activeBoard } from "../lib/league";
import { computeVor } from "../lib/vor";
import { projectedPoints, lastSeasonPoints } from "../lib/projection";

// Board-content edits are reversible; switching league/tier-list contexts wipes
// the trail so undo never crosses into a different board. See the undo spec.
const UNDOABLE = new Set([
  "setAll",
  "add",
  "remove",
  "update",
  "move",
  "setRank",
  "splitTier",
  "removeBreak",
  "merge",
  "applyAdp",
]);
const CLEAR = new Set([
  "setLeagues",
  "switchLeague",
  "addLeague",
  "duplicateLeague",
  "deleteLeague",
  "switchTierList",
  "addTierList",
  "duplicateTierList",
  "deleteTierList",
]);

const reducerWithHistory = withHistory<
  LeaguesState,
  Action | LeagueAction | TierListAction
>(leaguesReducer, { undoable: UNDOABLE, clear: CLEAR, limit: 25 });

export function useRankings() {
  const [hist, dispatch] = useReducer(reducerWithHistory, undefined, () => ({
    past: [],
    present: loadLeagues(),
  }));
  const state = hist.present;
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
  const undo = () => dispatch({ type: "undo" });
  return {
    players,
    vorById,
    projById,
    lastById,
    dispatch,
    refresh,
    undo,
    canUndo: hist.past.length > 0,
    currentLeague: current,
    leagues: state.leagues,
    tierLists: current.tierLists.map(({ id, name }) => ({ id, name })),
    activeTierListId: current.activeTierListId,
    defaultTierListId: current.defaultTierListId,
  };
}

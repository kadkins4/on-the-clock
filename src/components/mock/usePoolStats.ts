import { useMemo } from "react";
import type { MockState } from "../../lib/mock/types";
import { computeVor } from "../../lib/vor";
import { projectedPoints } from "../../lib/projection";

export interface PoolStats {
  // player id → projected points scored at the mock's league settings (null
  // when the player has no projection). Use this over the raw player.projPoints
  // so PROJ matches the league's scoring/TE-premium — the same scorer VOR uses.
  projById: Record<string, number | null>;
  // player id → value over replacement (null when no projection / no baseline).
  vorById: Record<string, number | null>;
}

// Derives the mock pick pool's PROJ + VOR maps from a draft state. Pure
// derivation memoized on the snapshot inputs (pool/scoring/roster/teams/TE
// premium) — these are frozen at draft start, so the maps compute once per
// mock. Mirrors the research board's useRankings VOR/PROJ wiring.
export function usePoolStats(state: MockState): PoolStats {
  const tePremium = state.tePremium ?? false;
  return useMemo(() => {
    const projById: Record<string, number | null> = {};
    for (const p of state.pool) {
      projById[p.id] = projectedPoints(p, state.scoring, tePremium);
    }
    const vorById = computeVor(
      state.pool,
      state.roster,
      state.settings.teams,
      state.scoring,
      tePremium,
    );
    return { projById, vorById };
  }, [
    state.pool,
    state.scoring,
    state.roster,
    state.settings.teams,
    tePremium,
  ]);
}

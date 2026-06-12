import type { MockState } from "./types";
import { formatPick } from "./board";

export type PlayerDraftStatus =
  | { drafted: false }
  | { drafted: true; pickLabel: string; teamName: string };

/**
 * Returns the draft status of a player in a mock draft.
 * Pure — derives everything from MockState.
 */
export function playerDraftStatus(
  state: MockState,
  playerId: string,
): PlayerDraftStatus {
  if (!state.draftedIds.has(playerId)) {
    return { drafted: false };
  }
  const pick = state.picks.find((p) => p.playerId === playerId);
  if (!pick) {
    // Should not happen if draftedIds is consistent, but guard anyway.
    return { drafted: false };
  }
  const pickLabel = formatPick(pick.overall, state.settings.teams);
  const teamName =
    state.teams[pick.teamIndex]?.name ?? `Team ${pick.teamIndex + 1}`;
  return { drafted: true, pickLabel, teamName };
}

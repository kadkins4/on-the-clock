import type { League, Player, Position } from "../../types";
import type { MockSettings, MockState } from "./types";
import { defaultBoard } from "../league";
import { buildDraftOrder } from "./order";
import { openNeeds } from "./roster";
import { botPick } from "./bot";
import { makeRng } from "./rng";

function rosterSize(r: League["roster"]): number {
  return (
    r.QB + r.RB + r.WR + r.TE + r.FLEX + r.SUPERFLEX + r.K + r.DST + r.bench
  );
}

const byAdp = (a: Player, b: Player) => {
  if (a.adp == null && b.adp == null) return a.overallRank - b.overallRank;
  if (a.adp == null) return 1;
  if (b.adp == null) return -1;
  return a.adp - b.adp;
};

export function createMock(
  league: League,
  settings: Omit<MockSettings, "rounds">,
  seed: number,
): MockState {
  const rounds = rosterSize(league.roster);
  // a mock drafts from the league's default tier list
  const pool = defaultBoard(league)
    .filter((pl) => !league.roster.disabled.includes(pl.position))
    .map((pl) => ({ ...pl }))
    .sort(byAdp);
  return {
    pool,
    scoring: league.scoring,
    roster: league.roster,
    settings: { ...settings, rounds },
    order: buildDraftOrder(settings.teams, rounds, settings.thirdRoundReversal),
    picks: [],
    draftedIds: new Set(),
    seed,
  };
}

export function isComplete(m: MockState): boolean {
  return m.picks.length >= m.order.length;
}

export function currentTeamIndex(m: MockState): number {
  return m.order[m.picks.length];
}

export function available(m: MockState): Player[] {
  return m.pool.filter((pl) => !m.draftedIds.has(pl.id));
}

export function teamRosterPositions(
  m: MockState,
  teamIndex: number,
): Position[] {
  const byId = new Map(m.pool.map((pl) => [pl.id, pl]));
  return m.picks
    .filter((pk) => pk.teamIndex === teamIndex)
    .map((pk) => byId.get(pk.playerId)!.position);
}

export function draftPlayer(m: MockState, playerId: string): MockState {
  if (isComplete(m)) return m;
  if (m.draftedIds.has(playerId)) return m;
  if (!m.pool.some((pl) => pl.id === playerId)) return m;
  const overall = m.picks.length + 1;
  const teamIndex = currentTeamIndex(m);
  const round = Math.floor((overall - 1) / m.settings.teams) + 1;
  const draftedIds = new Set(m.draftedIds);
  draftedIds.add(playerId);
  return {
    ...m,
    draftedIds,
    picks: [...m.picks, { overall, round, teamIndex, playerId }],
  };
}

// Compute the id a bot would draft for the current team (does not mutate).
export function botPickId(m: MockState): string {
  const teamIndex = currentTeamIndex(m);
  const round = Math.floor(m.picks.length / m.settings.teams) + 1;
  const needs = openNeeds(teamRosterPositions(m, teamIndex), m.roster);
  // advance the seed per pick so successive bot picks vary
  const rng = makeRng(m.seed + m.picks.length * 2654435761);
  return botPick(available(m), needs, round, rng);
}

// Swap the player drafted at pick `overall` (1-based). Frees the old player
// back into the pool; refuses if the replacement is unknown or already drafted
// elsewhere. Keeps the slot's overall/round/teamIndex.
export function replacePick(
  m: MockState,
  overall: number,
  newPlayerId: string,
): MockState {
  const idx = overall - 1;
  if (idx < 0 || idx >= m.picks.length) return m;
  if (!m.pool.some((pl) => pl.id === newPlayerId)) return m;
  const old = m.picks[idx];
  if (newPlayerId !== old.playerId && m.draftedIds.has(newPlayerId)) return m;
  const draftedIds = new Set(m.draftedIds);
  draftedIds.delete(old.playerId);
  draftedIds.add(newPlayerId);
  const picks = m.picks.map((pk, i) =>
    i === idx ? { ...pk, playerId: newPlayerId } : pk,
  );
  return { ...m, draftedIds, picks };
}

// Undo every pick from `overall` onward, so pick `overall` is back on the clock.
// Rebuilds draftedIds from the surviving picks. `undoLastPick` is the N=last case.
export function rewindTo(m: MockState, overall: number): MockState {
  if (overall < 1 || overall > m.picks.length) return m;
  const picks = m.picks.slice(0, overall - 1);
  const draftedIds = new Set(picks.map((p) => p.playerId));
  return { ...m, picks, draftedIds };
}

export function undoLastPick(m: MockState): MockState {
  if (m.picks.length === 0) return m;
  const picks = m.picks.slice(0, -1);
  const removed = m.picks[m.picks.length - 1];
  const draftedIds = new Set(m.draftedIds);
  draftedIds.delete(removed.playerId);
  return { ...m, picks, draftedIds };
}

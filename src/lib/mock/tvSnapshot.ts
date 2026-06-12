import type { MockState } from "./types";
import { isComplete, currentTeamIndex } from "./engine";
import { formatPick } from "./board";
import type { CellKind } from "./board";

// ── types ─────────────────────────────────────────────────────────────────────

export interface TvRoundCell {
  overall: number;
  label: string;
  initials: string;
  surname: string | null;
  position: string | null;
  kind: CellKind;
}

export interface TvLatest {
  label: string;
  name: string;
  surname: string;
  position: string;
  team: string;
  bye: number | null;
  byTeam: string;
}

export interface TvUpNext {
  initials: string;
  name: string;
  color: string;
}

export interface TvTicker {
  label: string;
  surname: string;
  position: string;
}

export interface TvSnapshot {
  complete: boolean;
  round: number;
  overall: number;
  totalPicks: number;
  onClock: {
    name: string;
    initials: string;
    color: string;
    isUser: boolean;
  } | null;
  currentRound: TvRoundCell[];
  latest: TvLatest | null;
  upNext: TvUpNext[];
  ticker: TvTicker[];
}

// ── channel protocol (shared with TvWindow / MockDraft) ───────────────────────

export const TV_CHANNEL = "otc-tv";

export type TvMessage =
  | { type: "snapshot"; snapshot: TvSnapshot }
  | { type: "request" };

// ── helpers ───────────────────────────────────────────────────────────────────

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

// ── buildTvSnapshot ───────────────────────────────────────────────────────────

export function buildTvSnapshot(state: MockState): TvSnapshot {
  const { teams, picks, order, pool, settings } = state;
  const totalPicks = order.length;
  const madeCount = picks.length;
  const complete = isComplete(state);

  // current overall pick (1-based); clamp to totalPicks when complete
  const overall = Math.min(madeCount + 1, totalPicks);
  const round = Math.floor((overall - 1) / settings.teams) + 1;

  // onClock
  const onClock = complete
    ? null
    : (() => {
        const idx = currentTeamIndex(state);
        const t = teams[idx];
        if (!t) return null;
        return {
          name: t.name,
          initials: t.initials,
          color: t.color,
          isUser: t.isUser,
        };
      })();

  // player lookup
  const byId = new Map(pool.map((p) => [p.id, p]));

  // currentRound: all picks in the current round (round is derived from
  // `overall`, which is clamped when complete)
  const roundStart = (round - 1) * settings.teams; // 0-based
  const roundEnd = roundStart + settings.teams;
  const currentRound: TvRoundCell[] = [];
  for (let i = roundStart; i < roundEnd && i < order.length; i++) {
    const cellOverall = i + 1;
    const teamIdx = order[i];
    const teamId = teams[teamIdx];
    const label = formatPick(cellOverall, settings.teams);
    let kind: CellKind;
    if (cellOverall <= madeCount) {
      kind = "done";
    } else if (cellOverall === madeCount + 1) {
      kind = "current";
    } else {
      kind = "upcoming";
    }

    let sn: string | null = null;
    let position: string | null = null;
    if (kind === "done") {
      const pick = picks[i];
      if (pick) {
        const pl = byId.get(pick.playerId);
        if (pl) {
          sn = surname(pl.name);
          position = pl.position;
        }
      }
    }

    currentRound.push({
      overall: cellOverall,
      label,
      initials: teamId?.initials ?? "?",
      surname: sn,
      position,
      kind,
    });
  }

  // latest: most recent completed pick
  let latest: TvLatest | null = null;
  if (madeCount > 0) {
    const lastPick = picks[madeCount - 1];
    const pl = byId.get(lastPick.playerId);
    if (pl) {
      const byTeam = teams[lastPick.teamIndex]?.name ?? "";
      latest = {
        label: formatPick(lastPick.overall, settings.teams),
        name: pl.name,
        surname: surname(pl.name),
        position: pl.position,
        team: pl.team ?? "",
        bye: pl.byeWeek ?? null,
        byTeam,
      };
    }
  }

  // upNext: next up to 3 teams on the clock after the current pick
  const upNext: TvUpNext[] = [];
  const nextStart = madeCount + 2; // 1-based overall of the pick AFTER current
  for (let i = nextStart; i <= order.length && upNext.length < 3; i++) {
    const teamIdx = order[i - 1];
    const t = teams[teamIdx];
    if (t) upNext.push({ initials: t.initials, name: t.name, color: t.color });
  }

  // ticker: last up to 10 completed picks, most-recent last
  const tickerPicks = picks.slice(-10);
  const ticker: TvTicker[] = tickerPicks
    .map((pk): TvTicker | null => {
      const pl = byId.get(pk.playerId);
      if (!pl) return null;
      return {
        label: formatPick(pk.overall, settings.teams),
        surname: surname(pl.name),
        position: pl.position,
      };
    })
    .filter((t): t is TvTicker => t !== null);

  return {
    complete,
    round,
    overall,
    totalPicks,
    onClock,
    currentRound,
    latest,
    upNext,
    ticker,
  };
}

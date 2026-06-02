import { useEffect, useMemo, useState } from "react";
import type { MockState } from "../../lib/mock/types";
import type { Player, Position } from "../../types";
import {
  available,
  currentTeamIndex,
  isComplete,
  teamRosterPositions,
} from "../../lib/mock/engine";
import { userPickMarkers } from "../../lib/mock/board";
import { PickStrip } from "./PickStrip";
import { DraftBoardGrid } from "./DraftBoardGrid";

interface Props {
  state: MockState;
  userTeamIndex: number; // userSlot - 1
  onDraft: (playerId: string) => void; // user pick
  onBotTick: () => void; // advance one bot pick
  onUndo: () => void;
  onExit: () => void;
}

const POS_FILTERS: (Position | "All")[] = [
  "All",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

export function MockDraft({
  state,
  userTeamIndex,
  onDraft,
  onBotTick,
  onUndo,
  onExit,
}: Props) {
  const [posFilter, setPosFilter] = useState<Position | "All">("All");
  const [boardOpen, setBoardOpen] = useState(false);
  const onClock = currentTeamIndex(state);
  const isUser = onClock === userTeamIndex && !isComplete(state);
  const overall = state.picks.length + 1;
  const round = Math.floor((overall - 1) / state.settings.teams) + 1;

  // Bots pick automatically (short delay so the board visibly updates).
  useEffect(() => {
    if (isComplete(state)) return;
    if (onClock === userTeamIndex) return;
    const t = setTimeout(onBotTick, 800);
    return () => clearTimeout(t);
  }, [state, onClock, userTeamIndex, onBotTick]);

  const avail = useMemo(
    () =>
      available(state).filter(
        (p) => posFilter === "All" || p.position === posFilter,
      ),
    [state, posFilter],
  );

  const myPositions = teamRosterPositions(state, userTeamIndex);

  // Build the available list interleaved with "your pick" dotted lines. Each
  // line is placed by the player's NATURAL position in the full board order, so
  // it stays at its true round even when the list is filtered by position (a
  // line sits just above the first visible player at/after that board slot).
  type AvailRow =
    | { kind: "line"; round: number; key: string }
    | { kind: "player"; p: Player };
  const availRows = useMemo<AvailRow[]>(() => {
    const full = available(state);
    const fullIndex = new Map(full.map((p, i) => [p.id, i]));
    const markers = isComplete(state)
      ? []
      : userPickMarkers(state, userTeamIndex);
    const rows: AvailRow[] = [];
    let mi = 0;
    for (const p of avail.slice(0, 100)) {
      const f = fullIndex.get(p.id) ?? Infinity;
      while (mi < markers.length && markers[mi].availIndex <= f) {
        rows.push({
          kind: "line",
          round: markers[mi].round,
          key: `m${markers[mi].overall}`,
        });
        mi += 1;
      }
      rows.push({ kind: "player", p });
    }
    // your later picks fall past the last visible player — show them trailing
    while (mi < markers.length) {
      rows.push({
        kind: "line",
        round: markers[mi].round,
        key: `m${markers[mi].overall}`,
      });
      mi += 1;
    }
    return rows;
  }, [state, avail, userTeamIndex]);

  return (
    <div className="mock-draft">
      <div className="mock-status">
        <strong>
          {isComplete(state)
            ? "Draft complete"
            : isUser
              ? "You're on the clock"
              : `Team ${onClock + 1} picking…`}
        </strong>
        <span>
          Round {round} · Pick {overall} of {state.order.length}
        </span>
        <div className="mock-controls">
          <button
            className={boardOpen ? "active" : ""}
            onClick={() => setBoardOpen((v) => !v)}
          >
            {boardOpen ? "Hide board" : "Draft board"}
          </button>
          <button onClick={onUndo} disabled={state.picks.length === 0}>
            Undo
          </button>
          <button className="secondary" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>

      <div className="mock-myroster">
        Your team ({myPositions.length}):{" "}
        {myPositions.length ? myPositions.join(" · ") : "—"}
      </div>

      <div className="chips">
        {POS_FILTERS.map((p) => (
          <button
            key={p}
            className={posFilter === p ? "chip active" : "chip"}
            onClick={() => setPosFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <ul className="mock-available">
        {availRows.map((row) =>
          row.kind === "line" ? (
            <li className="mock-pick-line" aria-hidden="true" key={row.key}>
              <span className="mock-pick-line-label">R{row.round}</span>
              <span className="mock-pick-line-rule" />
            </li>
          ) : (
            <li key={row.p.id}>
              <span className="mock-name">{row.p.name}</span>
              <span className="mock-pos">{row.p.position}</span>
              <span className="mock-team">{row.p.team}</span>
              <span className="mock-adp num">
                {row.p.adp == null ? "" : Number(row.p.adp.toFixed(1))}
              </span>
              <button
                className="mock-draft-btn"
                disabled={!isUser}
                onClick={() => onDraft(row.p.id)}
              >
                Draft
              </button>
            </li>
          ),
        )}
      </ul>

      <DraftBoardGrid
        state={state}
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        canDraft={isUser}
        onDraft={onDraft}
      />
      <PickStrip state={state} />
    </div>
  );
}

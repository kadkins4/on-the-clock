import { useEffect, useMemo, useState } from "react";
import type { MockState } from "../../lib/mock/types";
import type { Position } from "../../types";
import {
  available,
  currentTeamIndex,
  isComplete,
  teamRosterPositions,
} from "../../lib/mock/engine";
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
        {avail.slice(0, 100).map((p) => (
          <li key={p.id}>
            <span className="mock-name">{p.name}</span>
            <span className="mock-pos">{p.position}</span>
            <span className="mock-team">{p.team}</span>
            <span className="mock-adp num">
              {p.adp == null ? "" : Number(p.adp.toFixed(1))}
            </span>
            <button
              className="mock-draft-btn"
              disabled={!isUser}
              onClick={() => onDraft(p.id)}
            >
              Draft
            </button>
          </li>
        ))}
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

import type { ReactNode } from "react";
import type { MockState } from "../../lib/mock/types";

interface Props {
  state: MockState;
  status: ReactNode;
  round: number;
  overall: number;
  isUser: boolean;
  isComplete: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onUndo: () => void;
  onExit: () => void;
  timer?: ReactNode; // pick-timer UI, shown on the user's clock
}

// Last few picks as "Name (POS)", most recent first.
function recentPicks(state: MockState): { id: string; label: string }[] {
  const byId = new Map(state.pool.map((p) => [p.id, p]));
  return state.picks
    .slice(-5)
    .reverse()
    .map((pk) => {
      const p = byId.get(pk.playerId);
      return {
        id: `${pk.overall}`,
        label: p ? `${p.name} (${p.position})` : "—",
      };
    });
}

export function OnTheClockBanner({
  state,
  status,
  round,
  overall,
  isUser,
  isComplete,
  paused,
  onTogglePause,
  onUndo,
  onExit,
  timer,
}: Props) {
  const recent = recentPicks(state);
  return (
    <div className="mock-banner">
      <div className="mock-banner-main">
        <strong>{status}</strong>
        <span className="mock-banner-pick">
          R{round} · Pick {overall} of {state.order.length}
        </span>
        {isUser && timer}
      </div>

      {recent.length > 0 && (
        <div className="mock-ticker">
          {recent.map((r) => (
            <span className="mock-ticker-item" key={r.id}>
              {r.label}
            </span>
          ))}
        </div>
      )}

      <div className="mock-controls">
        {!isUser && !isComplete && (
          <button className={paused ? "active" : ""} onClick={onTogglePause}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
        )}
        <button onClick={onUndo} disabled={state.picks.length === 0}>
          Undo
        </button>
        <button className="secondary" onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import type { MockState } from "../../lib/mock/types";
import { OnTheClockReveal } from "./OnTheClockReveal";

interface Props {
  state: MockState;
  round: number;
  overall: number;
  isUser: boolean;
  isComplete: boolean;
  paused: boolean;
  picksAway: number; // picksUntilUser; >= 1 while the user waits
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onUndo: () => void;
  onExit: () => void;
  timer?: ReactNode; // large pick-clock UI, shown on the user's turn
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

function waitingLabel(picksAway: number): string {
  if (picksAway < 0) return "no more picks";
  if (picksAway === 0) return "almost up";
  return picksAway === 1 ? "1 pick away" : `${picksAway} picks away`;
}

export function OnTheClockBanner({
  state,
  round,
  overall,
  isUser,
  isComplete,
  paused,
  picksAway,
  muted,
  onToggleMute,
  onTogglePause,
  onUndo,
  onExit,
  timer,
}: Props) {
  const recent = recentPicks(state);
  return (
    <div className="mock-banner">
      <div className="mock-banner-main">
        <div className="mock-status">
          {!isComplete && <span className="mock-lead">You are now…</span>}
          <span className="mock-line2">
            {isComplete ? (
              "Draft complete"
            ) : isUser ? (
              // re-mount each new user pick so the reveal replays
              <OnTheClockReveal key={overall} />
            ) : (
              <span className="mock-waiting">{waitingLabel(picksAway)}</span>
            )}
          </span>
        </div>

        <div className="mock-banner-right">
          {isUser && !isComplete && timer}
          <span className="mock-banner-pick">
            R{round} · Pick {overall} of {state.order.length}
          </span>
        </div>
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
        <button
          className={`mock-mute${muted ? " muted" : ""}`}
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}

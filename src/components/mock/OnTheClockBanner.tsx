import { useState } from "react";
import type { ReactNode } from "react";
import type { MockState } from "../../lib/mock/types";
import { OnTheClockReveal } from "./OnTheClockReveal";

// Pick-clock durations for the settings cog. null = Off.
const TIMER_OPTIONS: { value: number | null; label: string }[] = [
  { value: 10, label: "0:10" },
  { value: 30, label: "0:30" },
  { value: 45, label: "0:45" },
  { value: 60, label: "1:00" },
  { value: 90, label: "1:30" },
  { value: 120, label: "2:00" },
  { value: null, label: "Off" },
];

// "NN picks away" — number zero-padded to 2 digits so the words never shift.
function waitingLabel(picksAway: number): ReactNode {
  if (picksAway < 0) return "no more picks";
  if (picksAway === 0) return "almost up";
  return (
    <>
      <span className="otc-picks-num">
        {String(picksAway).padStart(2, "0")}
      </span>{" "}
      {picksAway === 1 ? "pick" : "picks"} away
    </>
  );
}

interface Props {
  state: MockState;
  round: number;
  overall: number;
  isUser: boolean;
  isComplete: boolean;
  paused: boolean;
  picksAway: number; // picksUntilUser; >= 1 while the user waits
  urgent: boolean; // pick clock in its final seconds
  muted: boolean;
  onToggleMute: () => void;
  timerSec: number | null;
  onTimerSecChange: (s: number | null) => void;
  onTogglePause: () => void;
  onUndo: () => void;
  onExit: () => void;
  timer?: ReactNode; // large pick-clock UI, shown on the user's turn
}

export function OnTheClockBanner({
  state,
  round,
  overall,
  isUser,
  isComplete,
  paused,
  picksAway,
  urgent,
  muted,
  onToggleMute,
  timerSec,
  onTimerSecChange,
  onTogglePause,
  onUndo,
  onExit,
  timer,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mock-banner">
      <div className="mock-banner-main">
        <div className="otc-banner-status">
          {!isComplete && <span className="mock-lead">You are now…</span>}
          <span className={`mock-line2${urgent ? " urgent" : ""}`}>
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
        <div className="mock-settings-wrap">
          <button
            className={`mock-cog${settingsOpen ? " active" : ""}`}
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Pick-clock settings"
            title="Pick-clock settings"
          >
            ⚙
          </button>
          {settingsOpen && (
            <>
              <div
                className="mock-settings-scrim"
                onClick={() => setSettingsOpen(false)}
              />
              <div className="mock-settings-pop" role="menu">
                <div className="mock-settings-head">Pick clock</div>
                {TIMER_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    className={`mock-settings-opt${
                      timerSec === opt.value ? " active" : ""
                    }`}
                    onClick={() => {
                      onTimerSecChange(opt.value);
                      setSettingsOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import type { NudgeCopy } from "../../lib/mock/nudge";

interface Props {
  copy: NudgeCopy;
  onDismiss: () => void;
}

// The suggester banner: tells the user which strategy they're trending into and
// what to target next. Tone follows confidence (tentative vs committed).
export function StrategyNudge({ copy, onDismiss }: Props) {
  return (
    <div className={`strat-nudge${copy.tentative ? " tentative" : ""}`}>
      <span className="sn-icon" aria-hidden="true">
        {copy.icon}
      </span>
      <div className="sn-body">
        <div className="sn-head">
          {copy.headline} <strong>{copy.name}</strong>
        </div>
        <div className="sn-hint">{copy.hint}</div>
      </div>
      <button
        className="sn-x"
        aria-label="Dismiss suggestion"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
}

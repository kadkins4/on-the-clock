import type { NudgeCopy } from "../../lib/mock/nudge";

interface Props {
  copy: NudgeCopy;
  onDismiss: () => void;
}

// The suggester banner: tells the user which strategy they're running and what
// to target next. Only rendered once the detector is confident.
export function StrategyNudge({ copy, onDismiss }: Props) {
  return (
    <div className="strat-nudge">
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

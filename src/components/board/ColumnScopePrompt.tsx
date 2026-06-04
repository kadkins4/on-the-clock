import { useState } from "react";

interface Props {
  onChoose: (scope: "all" | "this", remember: boolean) => void;
  onCancel: () => void;
}

// Asked the first time a user edits columns (when their scope pref is "ask"):
// should this change apply to every league or just the current one?
export function ColumnScopePrompt({ onChoose, onCancel }: Props) {
  const [remember, setRemember] = useState(false);

  return (
    <div className="scope-prompt-backdrop" onMouseDown={onCancel}>
      <div
        className="scope-prompt"
        role="dialog"
        aria-label="Apply column changes"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="scope-prompt-text">Apply column changes to…</p>
        <div className="scope-prompt-actions">
          <button
            className="scope-prompt-btn"
            onClick={() => onChoose("all", remember)}
          >
            Apply to all leagues
          </button>
          <button
            className="scope-prompt-btn"
            onClick={() => onChoose("this", remember)}
          >
            Just this league
          </button>
        </div>
        <label className="scope-prompt-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />{" "}
          Don't ask again
        </label>
        <button className="scope-prompt-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

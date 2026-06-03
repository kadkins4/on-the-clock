import { useState } from "react";
import { SuggestionBox } from "./SuggestionBox";

const KEY = "otc:alpha-ack";

// Small dismissible "this is Alpha" notice. Remembered in localStorage so it
// shows once per browser, then stays gone until storage is cleared. The
// "tell us here" link opens an inline suggestion box.
export function AlphaBanner() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [open, setOpen] = useState(false);

  if (!show) return null;

  return (
    <div className="otc-alpha" role="status">
      <div className="otc-alpha-row">
        <span className="otc-alpha-tag">ALPHA</span>
        <span className="otc-alpha-msg">
          <strong>Actively in development.</strong> While in ALPHA, expect rough
          edges, incomplete styling, and your data <i>may</i> reset between
          updates. We'll try our best not to interrupt. Suggestions or requests?{" "}
          <button
            type="button"
            className="otc-link"
            onClick={() => setOpen((o) => !o)}
          >
            Tell us here
          </button>
          .
        </span>
        <button
          className="otc-alpha-x"
          aria-label="Dismiss"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
        >
          ✕
        </button>
      </div>
      {open && <SuggestionBox onClose={() => setOpen(false)} />}
    </div>
  );
}

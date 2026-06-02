import { useState } from "react";

const KEY = "otc:alpha-ack";

// Small dismissible "this is Alpha" notice. Remembered in localStorage so it
// shows once per browser, then stays gone until storage is cleared.
export function AlphaBanner() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch {
      return true;
    }
  });

  if (!show) return null;

  return (
    <div className="otc-alpha" role="status">
      <span className="otc-alpha-tag">ALPHA</span>
      {/* @TODO: We need a place for suggestions and a place to show brief changelog */}
      <span className="otc-alpha-msg">
        <strong>Actively in development.</strong> While in ALPHA, expect rough edges, incomplete styling, and your data <i>may</i> reset between updates. We will try our best to not interrupt. If you have any suggestions/requests for the team, please submit them here.
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
  );
}

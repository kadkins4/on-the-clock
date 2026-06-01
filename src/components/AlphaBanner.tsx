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
      <span className="otc-alpha-msg">
        Actively in development — expect rough edges, and your data may reset
        between updates.
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

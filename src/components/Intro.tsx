import { useEffect, useState } from "react";

const KEY = "otc:intro-seen";

// Snappy one-shot splash: stopwatch mark + wordmark, ~1.2s, then fades out.
// Plays once per browser session; click anywhere to skip. Placeholder polish.
export function Intro() {
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(dismiss, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  function dismiss() {
    setLeaving(true);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode — just play again next time */
    }
    setTimeout(() => setShow(false), 420);
  }

  if (!show) return null;

  return (
    <div
      className={`otc-intro ${leaving ? "leaving" : ""}`}
      onClick={dismiss}
      role="presentation"
    >
      <svg
        className="otc-intro-mark"
        viewBox="0 0 64 64"
        width="104"
        height="104"
      >
        <circle
          className="ring"
          cx="32"
          cy="34"
          r="17"
          fill="none"
          stroke="#ff6b4a"
          strokeWidth="4"
        />
        <rect x="26" y="9" width="12" height="5" rx="2.5" fill="#ff6b4a" />
        <g className="hands">
          <line
            x1="32"
            y1="34"
            x2="32"
            y2="23"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line
            x1="32"
            y1="34"
            x2="40"
            y2="38"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="otc-intro-word">
        <span>On the</span> <strong>Clock</strong>
      </div>
      <div className="otc-intro-sub">Fantasy draft helper</div>
    </div>
  );
}

// Small stopwatch glyph matching the logo/splash mark. `urgent` sweeps the hand
// (like a running clock) to signal the pick timer is about to expire.
export function StopwatchMark({ urgent = false }: { urgent?: boolean }) {
  return (
    <svg
      className={`mock-stopwatch${urgent ? " urgent" : ""}`}
      viewBox="0 0 64 64"
      width="34"
      height="34"
      aria-hidden="true"
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
      <line
        className="hand"
        x1="32"
        y1="34"
        x2="32"
        y2="23"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

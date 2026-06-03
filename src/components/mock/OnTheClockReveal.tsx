import { useEffect, useState } from "react";

const TEXT = "On The Clock.";
const CLOCK_START = TEXT.indexOf("Clock");
const CLOCK_END = CLOCK_START + "Clock".length;

// Splash-style reveal of the wordmark for the mock banner: types "On The Clock."
// (gray "On The"/".", orange "Clock") then finishes with a glow pulse. Mounts
// fresh each time the user goes on the clock (parent keys it by pick), so the
// reveal replays on every turn.
export function OnTheClockReveal() {
  const [n, setN] = useState(0);
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    let i = 0;
    let t = window.setTimeout(function step() {
      i += 1;
      setN(i);
      if (i < TEXT.length) {
        t = window.setTimeout(step, 95);
      } else {
        setGlow(true);
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, []);

  const typed = TEXT.slice(0, n);
  return (
    <span className={`mock-otc-reveal${glow ? " glow" : ""}`}>
      <span className="ink">{typed.slice(0, CLOCK_START)}</span>
      <span className="accent">{typed.slice(CLOCK_START, CLOCK_END)}</span>
      <span className="ink">{typed.slice(CLOCK_END)}</span>
      {n < TEXT.length && <span className="otc-caret" aria-hidden="true" />}
    </span>
  );
}

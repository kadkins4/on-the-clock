import { useEffect, useRef, useState } from "react";

const KEY = "otc:intro-seen";
const LINE1 = "You are now...";
const LINE2 = "On The Clock";

// Splash: a crisp stopwatch draws while a typewriter reads
// "You're now... On The Clock", then a clean fade reveals the draft sheet.
// Plays once per browser session; click to skip. Placeholder polish.
// `replay` is a counter — bumping it (e.g. clicking the header) re-runs the
// splash from the top, regardless of the once-per-session flag.
export function Intro({ replay = 0 }: { replay?: number }) {
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [typed1, setTyped1] = useState("");
  const [typed2, setTyped2] = useState("");
  const [phase, setPhase] = useState<"typing" | "leaving">("typing");
  const timer = useRef<number | undefined>(undefined);

  // Replay on demand: reset the typewriter and show the overlay again. Skips
  // the initial render (replay === 0) so first-load behavior is unchanged.
  useEffect(() => {
    if (!replay) return;
    setTyped1("");
    setTyped2("");
    setPhase("typing");
    setShow(true);
  }, [replay]);

  // While the splash is up: drop focus from whatever was clicked (so Enter
  // can't re-fire it), and let Esc / Enter / Space / (click, handled below)
  // skip the whole thing. Any other key is ignored.
  useEffect(() => {
    if (!show) return;
    (document.activeElement as HTMLElement | null)?.blur();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        skip();
      }
    };
    // capture so a focused button can't act on Enter/Space before we skip
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    let i = 0;
    let j = 0;
    const step = () => {
      if (i < LINE1.length) {
        i += 1;
        setTyped1(LINE1.slice(0, i));
        // longer beat on the trailing "..."
        const ch = LINE1[i - 1];
        timer.current = window.setTimeout(step, ch === "." ? 240 : 95);
      } else if (j < LINE2.length) {
        j += 1;
        setTyped2(LINE2.slice(0, j));
        timer.current = window.setTimeout(step, 115);
      } else {
        timer.current = window.setTimeout(() => setPhase("leaving"), 650);
      }
    };
    timer.current = window.setTimeout(step, 450);
    return () => window.clearTimeout(timer.current);
  }, [show]);

  function finish() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode — replays next session */
    }
    setShow(false);
  }

  function skip() {
    window.clearTimeout(timer.current);
    finish();
  }

  if (!show) return null;

  return (
    <div
      className={`otc-intro ${phase === "leaving" ? "leaving" : ""}`}
      onClick={skip}
      role="presentation"
    >
      <div
        className="otc-intro-panel"
        onAnimationEnd={
          phase === "leaving"
            ? (e) => {
                if (e.target === e.currentTarget) finish();
              }
            : undefined
        }
      >
        <svg
          className="otc-intro-mark"
          viewBox="0 0 64 64"
          width="92"
          height="92"
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
        <div className="otc-type">
          <div className="otc-type-1">{typed1}</div>
          <div className="otc-type-2">
            {typed2}
            {/* caret holds for a beat once line 1 finishes, then leads line 2 */}
            {phase === "typing" && typed1 === LINE1 && (
              <span className="otc-caret" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

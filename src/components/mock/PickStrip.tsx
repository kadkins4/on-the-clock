import { useEffect, useRef } from "react";
import type { MockState } from "../../lib/mock/types";
import { buildPickCells } from "../../lib/mock/board";

interface Props {
  state: MockState;
  onPickClick?: (overall: number) => void;
}

// The always-docked mini board. Auto-recenters on the current pick as the draft
// advances, but holds still while you're interacting with it (pointer over or
// keyboard focus) so it never yanks out from under you mid-scroll.
export function PickStrip({ state, onPickClick }: Props) {
  const cells = buildPickCells(state);
  const made = state.picks.length;
  const currentRef = useRef<HTMLDivElement | null>(null);
  const interacting = useRef(false);

  useEffect(() => {
    if (interacting.current) return;
    currentRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [made]);

  return (
    <div
      className="mock-strip"
      aria-label="pick board"
      onPointerEnter={() => (interacting.current = true)}
      onPointerLeave={() => (interacting.current = false)}
      onFocusCapture={() => (interacting.current = true)}
      onBlurCapture={() => (interacting.current = false)}
    >
      {cells.map((c) => (
        <div
          key={c.overall}
          ref={c.kind === "current" ? currentRef : undefined}
          className={`strip-card ${c.kind} ${c.position ? `pos-${c.position}` : ""} ${
            c.kind === "done" && onPickClick ? "clickable" : ""
          }`}
          role={c.kind === "done" && onPickClick ? "button" : undefined}
          onClick={
            c.kind === "done" && onPickClick
              ? () => onPickClick(c.overall)
              : undefined
          }
        >
          <span className="strip-pick">{c.label}</span>
          {c.kind === "done" ? (
            <>
              {c.signal && (
                <span className={`num-dot ${c.signal.kind}`}>
                  {c.signal.amount}
                </span>
              )}
              <span className="strip-name" title={c.name}>
                {c.name}
              </span>
              <span className="strip-pos">{c.position}</span>
            </>
          ) : (
            <span className="strip-team">
              {state.teams[c.teamIndex]?.name ?? c.teamLabel}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

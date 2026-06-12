import { useEffect, useRef } from "react";
import type { MockState } from "../../lib/mock/types";
import { buildPickCells } from "../../lib/mock/board";

interface Props {
  state: MockState;
  userTeamIndex: number;
  onOpenPlayer: (playerId: string) => void;
}

// The always-docked mini board. Auto-recenters on the current pick as the draft
// advances, but holds still while you're interacting with it (pointer over or
// keyboard focus) so it never yanks out from under you mid-scroll.
export function PickStrip({ state, userTeamIndex, onOpenPlayer }: Props) {
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
      {cells.map((c) => {
        const isUser = c.teamIndex === userTeamIndex;
        const isDone = c.kind === "done";
        const classNames = [
          "strip-card",
          c.kind,
          c.position ? `pos-${c.position}` : "",
          isDone ? "clickable" : "",
          isUser ? "is-user" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={c.overall}
            ref={c.kind === "current" ? currentRef : undefined}
            className={classNames}
            role={isDone ? "button" : undefined}
            onClick={
              isDone && c.playerId ? () => onOpenPlayer(c.playerId!) : undefined
            }
          >
            <span className={`strip-pick${isUser ? " strip-pick--user" : ""}`}>
              {c.label}
            </span>
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
            ) : c.kind === "current" ? (
              <>
                <span className="strip-otc">ON THE CLOCK</span>
                <span className="strip-team">
                  {state.teams[c.teamIndex]?.name ?? c.teamLabel}
                </span>
              </>
            ) : (
              <span className="strip-team">
                {state.teams[c.teamIndex]?.name ?? c.teamLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

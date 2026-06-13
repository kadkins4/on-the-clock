import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { MockState } from "../../lib/mock/types";
import { buildPickCells } from "../../lib/mock/board";

interface Props {
  state: MockState;
  userTeamIndex: number;
  onOpenPlayer: (playerId: string) => void;
  timer?: ReactNode; // live countdown shown on the on-the-clock card
  urgent?: boolean; // final 5 seconds — turns the current card red + blinks
}

// Small clock glyph for the on-the-clock card (per the build spec).
function ClockGlyph() {
  return (
    <svg
      className="strip-clock"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="9" />
      <path d="M12 7.5V13l3 2" />
    </svg>
  );
}

// The always-docked mini board. Auto-recenters on the current pick as the draft
// advances, but holds still while you're interacting with it (pointer over or
// keyboard focus) so it never yanks out from under you mid-scroll.
export function PickStrip({
  state,
  userTeamIndex,
  onOpenPlayer,
  timer,
  urgent,
}: Props) {
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
        const isCurrent = c.kind === "current";
        const abbr = state.teams[c.teamIndex]?.initials ?? c.teamLabel;
        const classNames = [
          "strip-card",
          c.kind,
          c.position ? `pos-${c.position}` : "",
          isDone ? "clickable" : "",
          isUser ? "is-user" : "",
          isCurrent && urgent ? "is-urgent" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={c.overall}
            ref={isCurrent ? currentRef : undefined}
            className={classNames}
            role={isDone ? "button" : undefined}
            onClick={
              isDone && c.playerId ? () => onOpenPlayer(c.playerId!) : undefined
            }
          >
            {/* Top row on every card: pick # (left) + team abbr (right). */}
            <span className="strip-top">
              <span
                className={`strip-pick${isUser ? " strip-pick--user" : ""}`}
              >
                {c.label}
              </span>
              <span className="strip-abbr">{abbr}</span>
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
              </>
            ) : isCurrent ? (
              <span className="strip-otc">
                <ClockGlyph />
                {timer ?? "—"}
              </span>
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

import { useEffect, useRef } from "react";
import type { MockState } from "../../lib/mock/types";
import { buildPickCells } from "../../lib/mock/board";

interface Props {
  state: MockState;
}

export function PickStrip({ state }: Props) {
  const cells = buildPickCells(state);
  const made = state.picks.length;
  const currentRef = useRef<HTMLDivElement | null>(null);

  // Auto-recenter on the current pick whenever the draft advances.
  useEffect(() => {
    currentRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [made]);

  return (
    <div className="mock-strip" aria-label="pick strip">
      {cells.map((c) => (
        <div
          key={c.overall}
          ref={c.kind === "current" ? currentRef : undefined}
          className={`strip-card ${c.kind} ${c.position ? `pos-${c.position}` : ""}`}
        >
          <span className="strip-pick">{c.label}</span>
          {c.kind === "done" ? (
            <>
              <span className="strip-name">{c.name}</span>
              <span className="strip-pos">{c.position}</span>
            </>
          ) : (
            <span className="strip-team">{c.teamLabel}</span>
          )}
        </div>
      ))}
    </div>
  );
}

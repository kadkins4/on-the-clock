import type { MockState } from "../../lib/mock/types";
import { buildPickCells } from "../../lib/mock/board";

interface Props {
  state: MockState;
  round: number; // current round (1-based)
}

// B6: the Broadcast Desk's right-hand "ROUND N" strip — every pick in the
// current round, top to bottom. Completed picks show the player; the current
// pick is highlighted; future picks are quiet "—" rows.
export function RoundStrip({ state, round }: Props) {
  const cells = buildPickCells(state).filter((c) => c.round === round);

  return (
    <div className="desk-round">
      <div className="desk-panel-title">Round {round}</div>
      <div className="desk-round-list">
        {cells.map((c) => {
          const team = state.teams[c.teamIndex];
          return (
            <div
              key={c.overall}
              className={`desk-round-row ${c.kind}${
                c.position ? ` pos-${c.position}` : ""
              }`}
            >
              <span className="drow-pick">{c.label}</span>
              <span className="drow-team">{team?.initials ?? ""}</span>
              {c.kind === "done" ? (
                <span className="drow-name" title={c.name}>
                  {c.name}
                </span>
              ) : c.kind === "current" ? (
                <span className="drow-otc">ON THE CLOCK</span>
              ) : (
                <span className="drow-empty">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

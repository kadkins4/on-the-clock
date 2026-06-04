import type { ReactNode } from "react";
import type { MockState } from "../../lib/mock/types";
import type { PickCell } from "../../lib/mock/board";
import { buildPickCells, userColumnIndex } from "../../lib/mock/board";
import { Avatar } from "./Avatar";

interface Props {
  state: MockState;
  onPickClick?: (overall: number) => void; // open the edit menu for a made pick
  timer?: ReactNode; // live countdown shown in the on-the-clock cell
}

// Small person silhouette for upcoming (not-yet-made) picks.
function Silhouette() {
  return (
    <svg className="bcg-silhouette" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

export function DraftBoardGrid({ state, onPickClick, timer }: Props) {
  const { teams, rounds } = state.settings;
  // Full grid including current/upcoming cells (not just made picks), so empty
  // slots can show a placeholder and the on-the-clock cell can show the timer.
  const grid: (PickCell | null)[][] = Array.from({ length: rounds }, () =>
    Array.from({ length: teams }, () => null as PickCell | null),
  );
  for (const c of buildPickCells(state)) grid[c.round - 1][c.teamIndex] = c;
  const userCol = userColumnIndex(state);

  return (
    <div className="board-inline">
      <div className="board-cardgrid" style={{ ["--cols" as string]: teams }}>
        <div className="bcg-teamrow">
          {state.teams.map((t, i) => (
            <div key={i} className={`bcg-team${t.isUser ? " you" : ""}`}>
              <Avatar
                initials={t.initials}
                color={t.color}
                size={28}
                ring={t.isUser}
              />
              <span className="bcg-tname">{t.name}</span>
            </div>
          ))}
        </div>
        {grid.map((row, r) => (
          <div className="bcg-row" key={r}>
            {row.map((cell, t) => {
              const userClass = t === userCol ? " user-col" : "";
              if (!cell) {
                return <div key={t} className={`bcg-cell empty${userClass}`} />;
              }
              if (cell.kind === "done") {
                return (
                  <div
                    key={t}
                    className={`bcg-cell pos-${cell.position} done${userClass}${
                      onPickClick ? " clickable" : ""
                    }`}
                    onClick={
                      onPickClick ? () => onPickClick(cell.overall) : undefined
                    }
                  >
                    <span className="bcg-pick">{cell.label}</span>
                    <span className="bcg-name">{cell.name}</span>
                    <span className="bcg-meta">{cell.position}</span>
                  </div>
                );
              }
              if (cell.kind === "current") {
                return (
                  <div key={t} className={`bcg-cell current${userClass}`}>
                    <span className="bcg-pick">{cell.label}</span>
                    <span className="bcg-clock">{timer ?? "⏱"}</span>
                  </div>
                );
              }
              // upcoming
              return (
                <div key={t} className={`bcg-cell upcoming${userClass}`}>
                  <span className="bcg-pick faded">{cell.label}</span>
                  <Silhouette />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

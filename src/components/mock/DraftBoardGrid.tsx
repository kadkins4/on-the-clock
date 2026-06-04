import type { ReactNode } from "react";
import type { MockState } from "../../lib/mock/types";
import type { PickCell } from "../../lib/mock/board";
import { buildPickCells, userColumnIndex } from "../../lib/mock/board";
import { available } from "../../lib/mock/engine";
import { Avatar } from "./Avatar";

interface Props {
  state: MockState;
  open: boolean;
  onClose: () => void;
  canDraft: boolean; // user is on the clock
  onDraft: (playerId: string) => void;
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

export function DraftBoardGrid({
  state,
  open,
  onClose,
  canDraft,
  onDraft,
  onPickClick,
  timer,
}: Props) {
  const { teams, rounds } = state.settings;
  // Full grid including current/upcoming cells (not just made picks), so empty
  // slots can show a placeholder and the on-the-clock cell can show the timer.
  const grid: (PickCell | null)[][] = Array.from({ length: rounds }, () =>
    Array.from({ length: teams }, () => null as PickCell | null),
  );
  for (const c of buildPickCells(state)) grid[c.round - 1][c.teamIndex] = c;
  const userCol = userColumnIndex(state);
  const peek = available(state).slice(0, 30);

  return (
    <div
      className={`mock-board-sheet ${open ? "open" : ""}`}
      aria-hidden={!open}
    >
      <div className="board-peek" aria-label="available players">
        {peek.map((pl, i) => (
          <button
            key={pl.id}
            className={`peek-row pos-${pl.position}`}
            disabled={!canDraft}
            onClick={() => onDraft(pl.id)}
          >
            <span className="peek-rank">{i + 1}</span>
            <span className="peek-name">{pl.name}</span>
            <span className="peek-pos">{pl.position}</span>
            <span className="peek-team">{pl.team}</span>
            <span className="peek-adp">
              {pl.adp == null ? "" : Number(pl.adp.toFixed(1))}
            </span>
          </button>
        ))}
      </div>

      <div className="board-head">
        <strong>Draft board</strong>
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="board-scroll">
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
                  return (
                    <div key={t} className={`bcg-cell empty${userClass}`} />
                  );
                }
                if (cell.kind === "done") {
                  return (
                    <div
                      key={t}
                      className={`bcg-cell pos-${cell.position} done${userClass}${
                        onPickClick ? " clickable" : ""
                      }`}
                      onClick={
                        onPickClick
                          ? () => onPickClick(cell.overall)
                          : undefined
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
    </div>
  );
}

import type { ReactNode } from "react";
import type { MockState } from "../../lib/mock/types";
import type { PickCell } from "../../lib/mock/board";
import { buildPickCells, userColumnIndex } from "../../lib/mock/board";
import { roundDirection } from "../../lib/mock/boardDirection";
import { Avatar } from "./Avatar";

interface Props {
  state: MockState;
  onPickClick?: (overall: number) => void; // open the edit menu for a made pick
  timer?: ReactNode; // live countdown shown in the on-the-clock cell
  urgent?: boolean; // final 5 seconds — turns the current cell red + faster pulse
}

export function DraftBoardGrid({ state, onPickClick, timer, urgent }: Props) {
  const { teams, rounds } = state.settings;
  // Full grid including current/upcoming cells (not just made picks), so empty
  // slots can show a placeholder and the on-the-clock cell can show the timer.
  const grid: (PickCell | null)[][] = Array.from({ length: rounds }, () =>
    Array.from({ length: teams }, () => null as PickCell | null),
  );
  for (const c of buildPickCells(state)) grid[c.round - 1][c.teamIndex] = c;
  const userCol = userColumnIndex(state);

  return (
    <div className="wall-wrap">
      {/* Left rail: round numbers + direction arrows */}
      <div className="wall-rail" aria-hidden="true">
        {/* Spacer to align with the team header row */}
        <div className="wall-rail-spacer" />
        {Array.from({ length: rounds }, (_, r) => {
          const dir = roundDirection(state.order, teams, r + 1);
          return (
            <div key={r} className="wall-rail-row">
              <span className="wall-rail-round">{r + 1}</span>
              <span className="wall-rail-arrow">
                {dir === "ltr" ? "→" : "←"}
              </span>
            </div>
          );
        })}
      </div>

      {/* The Wall grid */}
      <div className="board-inline">
        <div className="board-cardgrid" style={{ ["--cols" as string]: teams }}>
          {/* Team header row */}
          <div className="bcg-teamrow">
            {state.teams.map((t, i) => (
              <div key={i} className={`bcg-team${t.isUser ? " you" : ""}`}>
                <Avatar
                  initials={t.initials}
                  color={t.color}
                  size={22}
                  ring={t.isUser}
                />
                <span className="bcg-tname">{t.name}</span>
                <span className="bcg-slot">S{i + 1}</span>
              </div>
            ))}
          </div>

          {/* Pick rows */}
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
                  const subMeta = [
                    cell.position,
                    cell.nflTeam,
                    cell.byeWeek != null ? `B${cell.byeWeek}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
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
                      {subMeta && (
                        <span className="bcg-submeta">{subMeta}</span>
                      )}
                    </div>
                  );
                }

                if (cell.kind === "current") {
                  const isUserCell = t === userCol;
                  return (
                    <div
                      key={t}
                      className={`bcg-cell current${userClass}${isUserCell ? " current-user" : ""}${urgent ? " is-urgent" : ""}`}
                    >
                      <span className="bcg-pick">{cell.label}</span>
                      <span className="bcg-otc-label">● ON THE CLOCK</span>
                      <span className="bcg-clock">{timer ?? "⏱"}</span>
                    </div>
                  );
                }

                // upcoming
                return (
                  <div key={t} className={`bcg-cell upcoming${userClass}`}>
                    <span className="bcg-pick faded">{cell.label}</span>
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

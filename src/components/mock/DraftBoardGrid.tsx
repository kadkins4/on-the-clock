import type { MockState } from "../../lib/mock/types";
import { buildBoardGrid, userColumnIndex } from "../../lib/mock/board";
import { available } from "../../lib/mock/engine";
import { Avatar } from "./Avatar";

interface Props {
  state: MockState;
  open: boolean;
  onClose: () => void;
  canDraft: boolean; // user is on the clock
  onDraft: (playerId: string) => void;
  onPickClick?: (overall: number) => void; // open the edit menu for a made pick
}

export function DraftBoardGrid({
  state,
  open,
  onClose,
  canDraft,
  onDraft,
  onPickClick,
}: Props) {
  const grid = buildBoardGrid(state);
  const userCol = userColumnIndex(state);
  const teams = state.settings.teams;
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
              {row.map((cell, t) => (
                <div
                  key={t}
                  className={
                    "bcg-cell " +
                    (cell ? `pos-${cell.position} done` : "empty") +
                    (t === userCol ? " user-col" : "") +
                    (cell && onPickClick ? " clickable" : "")
                  }
                  onClick={
                    cell && onPickClick
                      ? () => onPickClick(cell.overall)
                      : undefined
                  }
                >
                  {cell ? (
                    <>
                      <span className="bcg-pick">{cell.label}</span>
                      <span className="bcg-name">{cell.name}</span>
                      <span className="bcg-meta">{cell.position}</span>
                    </>
                  ) : (
                    <span className="bcg-pick faded">
                      {/* upcoming label */}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

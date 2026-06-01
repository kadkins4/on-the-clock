import type { MockState } from "../../lib/mock/types";
import { buildBoardGrid, userColumnIndex } from "../../lib/mock/board";
import { available } from "../../lib/mock/engine";

interface Props {
  state: MockState;
  open: boolean;
  onClose: () => void;
  canDraft: boolean; // user is on the clock
  onDraft: (playerId: string) => void;
}

export function DraftBoardGrid({
  state,
  open,
  onClose,
  canDraft,
  onDraft,
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
        <table className="board-grid">
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: teams }, (_, t) => (
                <th key={t} className={t === userCol ? "user-col" : ""}>
                  {t === userCol ? "You" : `T${t + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <th className="round-label">R{r + 1}</th>
                {row.map((cell, t) => (
                  <td
                    key={t}
                    className={`board-cell ${t === userCol ? "user-col" : ""} ${
                      cell ? `pos-${cell.position}` : "empty"
                    }`}
                  >
                    {cell && (
                      <>
                        <span className="cell-pick">{cell.label}</span>
                        <span className="cell-name">{cell.name}</span>
                        <span className="cell-pos">{cell.position}</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

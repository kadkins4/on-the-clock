import { useRef, useState, type Dispatch } from "react";
import type { Player } from "../../types";
import type { Action } from "../../state/reducer";

// The overall-rank (#) cell. Double-click to edit: type a new rank, then Enter
// (or click away) to move the player there and shift everyone between; Escape
// cancels. Out-of-range values are clamped by the reducer (moveToRank).
export function RankCell({
  player,
  dispatch,
}: {
  player: Player;
  dispatch: Dispatch<Action>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  // Guards the single commit: once Enter/Escape has resolved the edit, the
  // input's blur (fired as it unmounts) must not commit a second time.
  const doneRef = useRef(false);

  const begin = () => {
    doneRef.current = false;
    setValue(String(player.overallRank));
    setEditing(true);
  };

  const commit = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    const rank = parseInt(value, 10);
    if (Number.isFinite(rank) && rank !== player.overallRank) {
      dispatch({ type: "setRank", id: player.id, rank });
    }
  };

  const cancel = () => {
    doneRef.current = true; // stop the unmount blur from committing
    setEditing(false);
  };

  if (!editing) {
    return (
      <td
        className="rank num"
        title="Double-click to edit rank"
        onDoubleClick={begin}
      >
        {player.overallRank}
      </td>
    );
  }

  return (
    <td className="rank num">
      <input
        className="rank-input"
        type="number"
        min={1}
        autoFocus
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
    </td>
  );
}

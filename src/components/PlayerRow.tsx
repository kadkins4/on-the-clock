import type { Dispatch, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player, Position, Flag } from "../types";
import { POSITIONS } from "../types";
import type { Action } from "../state/reducer";

interface Props {
  player: Player;
  positionalRank: number;
  draggable: boolean;
  dispatch: Dispatch<Action>;
}

export function PlayerRow({
  player,
  positionalRank,
  draggable,
  dispatch,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id, disabled: !draggable });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : player.drafted ? 0.45 : 1,
  };

  const upd = (patch: Partial<Player>) =>
    dispatch({ type: "update", id: player.id, patch });

  const cycleFlag = () => {
    const next: Flag =
      player.flag === "none"
        ? "target"
        : player.flag === "target"
          ? "avoid"
          : "none";
    upd({ flag: next });
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={player.drafted ? "row drafted" : "row"}
    >
      <td
        className="drag"
        {...(draggable ? { ...attributes, ...listeners } : {})}
      >
        {draggable ? "⠷" : ""}
      </td>
      <td className="rank">{player.overallRank}</td>
      <td>
        <button
          className={`flag flag-${player.flag}`}
          onClick={cycleFlag}
          title={player.flag}
        >
          {player.flag === "target" ? "★" : player.flag === "avoid" ? "⚑" : "·"}
        </button>
      </td>
      <td>
        <input
          className="name"
          value={player.name}
          onChange={(e) => upd({ name: e.target.value })}
        />
      </td>
      <td className="pos">
        <select
          value={player.position}
          onChange={(e) => upd({ position: e.target.value as Position })}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="posrank">
          {player.position}
          {positionalRank}
        </span>
      </td>
      <td>
        <input
          className="team"
          value={player.team}
          onChange={(e) => upd({ team: e.target.value.toUpperCase() })}
        />
      </td>
      <td>
        <input
          className="num"
          value={player.byeWeek ?? ""}
          onChange={(e) =>
            upd({
              byeWeek: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </td>
      <td>
        <input
          className="num"
          value={player.tier ?? ""}
          onChange={(e) =>
            upd({ tier: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </td>
      <td>
        <input
          className="num"
          value={player.adp ?? ""}
          onChange={(e) =>
            upd({ adp: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </td>
      <td>
        <input
          className="notes"
          value={player.notes}
          onChange={(e) => upd({ notes: e.target.value })}
        />
      </td>
      <td className="drafted-cell">
        <input
          type="checkbox"
          checked={player.drafted}
          onChange={() => dispatch({ type: "toggleDrafted", id: player.id })}
        />
      </td>
      <td>
        <button
          className="del"
          onClick={() => dispatch({ type: "remove", id: player.id })}
        >
          {"✕"}
        </button>
      </td>
    </tr>
  );
}

import type { Dispatch, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player, Flag } from "../types";
import type { Action } from "../state/reducer";
import { nextDraftStatus } from "../lib/draft";
import { rowState } from "../lib/rowState";

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

interface Props {
  player: Player;
  positionalRank: number;
  draggable: boolean;
  dispatch: Dispatch<Action>;
}

const DRAFT_LABEL: Record<Player["draftStatus"], string> = {
  available: "·",
  mine: "✓",
  taken: "✕",
};

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
    opacity: isDragging ? 0.5 : 1,
  };

  const upd = (patch: Partial<Omit<Player, "id" | "overallRank">>) =>
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

  const cycleDraft = () =>
    upd({ draftStatus: nextDraftStatus(player.draftStatus) });

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`row state-${rowState(player.draftStatus, player.flag)}`}
    >
      <td className="draft-cell">
        <button
          className={`draft draft-${player.draftStatus}`}
          onClick={cycleDraft}
          title={player.draftStatus}
        >
          {DRAFT_LABEL[player.draftStatus]}
        </button>
      </td>
      <td
        className="drag"
        {...(draggable ? { ...attributes, ...listeners } : {})}
      >
        {draggable ? "⠷" : ""}
      </td>
      <td className="rank">{player.overallRank}</td>
      <td className="pos">
        <span className="posrank">
          {player.position}·{player.team} ({player.position}
          {positionalRank})
        </span>
      </td>
      <td className="name-cell" title={player.name}>
        {player.name}
      </td>
      <td className="num">{player.byeWeek ?? ""}</td>
      <td className="num">{player.adp ?? ""}</td>
      <td>
        <input
          className="num tier-input"
          inputMode="numeric"
          value={player.tier ?? ""}
          onChange={(e) => upd({ tier: toNum(e.target.value) })}
        />
      </td>
      <td>
        <input
          className="notes"
          value={player.notes}
          onChange={(e) => upd({ notes: e.target.value })}
        />
      </td>
      <td>
        <button
          className={`flag flag-${player.flag}`}
          onClick={cycleFlag}
          title={player.flag}
        >
          {player.flag === "target" ? "★" : player.flag === "avoid" ? "⚑" : "·"}
        </button>
      </td>
    </tr>
  );
}

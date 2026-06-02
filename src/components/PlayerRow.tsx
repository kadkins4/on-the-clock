import type { Dispatch, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player, Flag } from "../types";
import type { Action } from "../state/reducer";
import { nextDraftStatus } from "../lib/draft";
import { rowState } from "../lib/rowState";
import { injuryBadge } from "../lib/injury";

interface Props {
  player: Player;
  positionalRank: number;
  vor: number | null;
  draggable: boolean;
  startsTier: boolean; // first player of its tier → "+" inserts an empty tier here
  onAddTier: (playerId: string, startsTier: boolean) => void;
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
  vor,
  draggable,
  startsTier,
  onAddTier,
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

  const inj = injuryBadge(player.injuryStatus);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`row state-${rowState(player.draftStatus, player.flag)}`}
    >
      <td className="mover">
        {draggable && (
          <>
            <button
              className="add-tier"
              title={
                startsTier
                  ? "Add an empty tier above this player"
                  : "Start a new tier here"
              }
              onClick={() => onAddTier(player.id, startsTier)}
            >
              ＋
            </button>
            <span className="drag-handle" {...attributes} {...listeners}>
              ⠷
            </span>
          </>
        )}
      </td>
      <td className="draft-cell">
        <button
          className={`draft draft-${player.draftStatus}`}
          onClick={cycleDraft}
          title={player.draftStatus}
        >
          {DRAFT_LABEL[player.draftStatus]}
        </button>
      </td>
      <td className="flag-cell">
        <button
          className={`flag flag-${player.flag}`}
          onClick={cycleFlag}
          title={player.flag}
        >
          {player.flag === "target" ? "★" : player.flag === "avoid" ? "⚑" : "·"}
        </button>
      </td>
      <td className="rank num">{player.overallRank}</td>
      <td className="name-cell" title={player.name}>
        {player.name}
        {inj && (
          <span
            className={`inj inj-${inj.severity}`}
            title={`${inj.label} — ${inj.description}`}
          >
            {inj.code}
          </span>
        )}
      </td>
      <td className="pos num">
        {player.position}
        {positionalRank}
      </td>
      <td className="team num">{player.team}</td>
      <td
        className="adp num"
        title={
          player.adpSources
            ? [
                player.adpSources.espn != null &&
                  `ESPN ${player.adpSources.espn.toFixed(1)}`,
                player.adpSources.ffc != null &&
                  `FFC ${player.adpSources.ffc.toFixed(1)}`,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            : undefined
        }
      >
        {player.adp == null ? "" : Number(player.adp.toFixed(1))}
      </td>
      <td className="vor num">
        {vor == null ? "—" : vor > 0 ? `+${vor}` : String(vor)}
      </td>
      <td className="bye num">{player.byeWeek ?? ""}</td>
      <td>
        <input
          className="notes"
          value={player.notes}
          onChange={(e) => upd({ notes: e.target.value })}
        />
      </td>
    </tr>
  );
}

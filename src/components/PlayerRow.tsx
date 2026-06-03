import type { Dispatch, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "../types";
import type { Action } from "../state/reducer";
import type { ColumnDef, ColumnId } from "../lib/columns";
import { rowState } from "../lib/rowState";
import { CELL_RENDERERS, type CellCtx } from "./board/cells";

interface Props {
  player: Player;
  columns: ColumnDef[];
  positionalRank: number;
  vor: number | null;
  proj: number | null;
  last: number | null;
  rookie: boolean;
  draggable: boolean;
  startsTier: boolean;
  stripe: boolean; // zebra: true => the lighter band
  onAddTier: (playerId: string, startsTier: boolean) => void;
  dispatch: Dispatch<Action>;
}

export function PlayerRow({
  player,
  columns,
  positionalRank,
  vor,
  proj,
  last,
  rookie,
  draggable,
  startsTier,
  stripe,
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

  const ctx: CellCtx = {
    positionalRank,
    vor,
    proj,
    last,
    rookie,
    draggable,
    startsTier,
    onAddTier,
    dispatch,
    dragAttributes: attributes,
    dragListeners: listeners,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={
        `row prow state-${rowState(player.draftStatus, player.flag)}` +
        (stripe ? " lite" : "")
      }
    >
      {columns.map((c) => (
        <CellSlot key={c.id} id={c.id} player={player} ctx={ctx} />
      ))}
    </tr>
  );
}

function CellSlot({
  id,
  player,
  ctx,
}: {
  id: ColumnId;
  player: Player;
  ctx: CellCtx;
}) {
  return <>{CELL_RENDERERS[id](player, ctx)}</>;
}

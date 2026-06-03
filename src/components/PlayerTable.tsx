import type { Dispatch, ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Player, SortKey } from "../types";
import type { Action } from "../state/reducer";
import type { ColumnDef } from "../lib/columns";
import { PlayerRow } from "./PlayerRow";
import { TierHeader, EmptyTier } from "./TierGroup";
import { ColumnHeader } from "./board/ColumnHeader";

export type DisplayGroup =
  | { kind: "tier"; tier: number; displayTier: number; players: Player[] }
  | { kind: "empty"; anchorId: string; displayTier: number };

interface Props {
  columns: ColumnDef[];
  grouped: boolean;
  display: DisplayGroup[];
  flat: Player[];
  positionalRanks: Record<string, number>;
  vorById: Record<string, number | null>;
  sortKey: SortKey | null;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  dispatch: Dispatch<Action>;
  reorderable: boolean;
  onAddTier: (playerId: string, startsTier: boolean) => void;
  onRemoveEmpty: (anchorId: string) => void;
}

export function PlayerTable({
  columns,
  grouped,
  display,
  flat,
  positionalRanks,
  vorById,
  sortKey,
  sortAsc,
  onSort,
  dispatch,
  reorderable,
  onAddTier,
  onRemoveEmpty,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const colSpan = columns.length;

  const orderedIds: string[] = [];
  if (grouped) {
    for (const g of display) {
      if (g.kind === "tier") g.players.forEach((p) => orderedIds.push(p.id));
    }
  } else {
    flat.forEach((p) => orderedIds.push(p.id));
  }

  const onDragEnd = (e: DragEndEvent) => {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || active === over) return;
    if (over.startsWith("empty:")) {
      const anchorId = over.slice(6);
      dispatch({
        type: "moveIntoNewTier",
        playerId: active,
        beforeId: anchorId,
      });
      onRemoveEmpty(anchorId);
      return;
    }
    dispatch({ type: "move", activeId: active, overId: over });
  };

  const renderRow = (p: Player, startsTier: boolean, stripe: boolean) => (
    <PlayerRow
      key={p.id}
      player={p}
      columns={columns}
      positionalRank={positionalRanks[p.id]}
      vor={vorById[p.id] ?? null}
      draggable={reorderable}
      startsTier={startsTier}
      stripe={stripe}
      onAddTier={onAddTier}
      dispatch={dispatch}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <table className="players">
        <thead>
          <ColumnHeader
            columns={columns}
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={onSort}
          />
        </thead>
        <tbody>
          <SortableContext
            items={orderedIds}
            strategy={verticalListSortingStrategy}
          >
            {grouped
              ? display.map((g) =>
                  g.kind === "empty" ? (
                    <EmptyTier
                      key={`empty:${g.anchorId}`}
                      anchorId={g.anchorId}
                      displayTier={g.displayTier}
                      colSpan={colSpan}
                      onRemove={onRemoveEmpty}
                    />
                  ) : (
                    <TierBlock
                      key={`tier:${g.tier}`}
                      group={g}
                      colSpan={colSpan}
                      editable={reorderable}
                      dispatch={dispatch}
                      renderRow={renderRow}
                    />
                  ),
                )
              : flat.map((p, i) => renderRow(p, false, i % 2 === 1))}
          </SortableContext>
        </tbody>
      </table>
    </DndContext>
  );
}

function TierBlock({
  group,
  colSpan,
  editable,
  dispatch,
  renderRow,
}: {
  group: Extract<DisplayGroup, { kind: "tier" }>;
  colSpan: number;
  editable: boolean;
  dispatch: Dispatch<Action>;
  renderRow: (p: Player, startsTier: boolean, stripe: boolean) => ReactNode;
}) {
  return (
    <>
      <TierHeader
        tier={group.tier}
        displayTier={group.displayTier}
        count={group.players.length}
        colSpan={colSpan}
        editable={editable}
        onRemove={(t) => dispatch({ type: "removeTier", tier: t })}
      />
      {group.players.map((p, i) => renderRow(p, i === 0, i % 2 === 1))}
    </>
  );
}

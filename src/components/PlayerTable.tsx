import type { Dispatch } from "react";
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
import { TierHeader, TierBreakRow } from "./TierGroup";
import { ColumnHeader } from "./board/ColumnHeader";

// Render model: an ordered list of rows — a non-sortable Tier 1 header,
// sortable break rows, and player rows — already interleaved and labelled
// with a running display-tier number.
export type DisplayRow =
  | { kind: "topHeader"; displayTier: number; count: number }
  | { kind: "break"; breakId: string; displayTier: number; count: number }
  | {
      kind: "player";
      player: Player;
      displayTier: number;
      startsTier: boolean;
      stripeIndex: number;
    };

interface Props {
  columns: ColumnDef[];
  grouped: boolean;
  rows: DisplayRow[];
  itemIds: string[]; // combined player + break ids, in order, for SortableContext
  flat: Player[];
  positionalRanks: Record<string, number>;
  vorById: Record<string, number | null>;
  projById: Record<string, number | null>;
  lastById: Record<string, number | null>;
  sortKey: SortKey | null;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  dispatch: Dispatch<Action>;
  reorderable: boolean;
  onAddTier: (playerId: string) => void;
}

export function PlayerTable({
  columns,
  grouped,
  rows,
  itemIds,
  flat,
  positionalRanks,
  vorById,
  projById,
  lastById,
  sortKey,
  sortAsc,
  onSort,
  dispatch,
  reorderable,
  onAddTier,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const colSpan = columns.length;

  const onDragEnd = (e: DragEndEvent) => {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || active === over) return;
    dispatch({ type: "move", activeId: active, overId: over });
  };

  const renderRow = (p: Player, startsTier: boolean, stripe: boolean) => (
    <PlayerRow
      key={p.id}
      player={p}
      columns={columns}
      positionalRank={positionalRanks[p.id]}
      vor={vorById[p.id] ?? null}
      proj={projById[p.id] ?? null}
      last={lastById[p.id] ?? null}
      rookie={false}
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
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            {grouped
              ? rows.map((r, i) => {
                  if (r.kind === "topHeader") {
                    return (
                      <TierHeader
                        key={`topHeader-${i}`}
                        tier={1}
                        displayTier={r.displayTier}
                        count={r.count}
                        colSpan={colSpan}
                        editable={false}
                        onRemove={() => {}}
                      />
                    );
                  }
                  if (r.kind === "break") {
                    return (
                      <TierBreakRow
                        key={r.breakId}
                        breakId={r.breakId}
                        displayTier={r.displayTier}
                        count={r.count}
                        colSpan={colSpan}
                        editable={reorderable}
                        onRemove={(breakId) =>
                          dispatch({ type: "removeBreak", breakId })
                        }
                      />
                    );
                  }
                  // r.kind === "player"
                  return renderRow(
                    r.player,
                    r.startsTier,
                    r.stripeIndex % 2 === 1,
                  );
                })
              : flat.map((p, i) => renderRow(p, false, i % 2 === 1))}
          </SortableContext>
        </tbody>
      </table>
    </DndContext>
  );
}

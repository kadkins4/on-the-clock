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
import type { Player } from "../types";
import type { Action } from "../state/reducer";
import { PlayerRow } from "./PlayerRow";
import { TierHeader, EmptyTier } from "./TierGroup";

export type DisplayGroup =
  | { kind: "tier"; tier: number; displayTier: number; players: Player[] }
  | { kind: "empty"; anchorId: string; displayTier: number };

interface Props {
  grouped: boolean;
  display: DisplayGroup[];
  flat: Player[];
  positionalRanks: Record<string, number>;
  dispatch: Dispatch<Action>;
  reorderable: boolean;
  onAddTier: (playerId: string, startsTier: boolean) => void;
  onRemoveEmpty: (anchorId: string) => void;
}

export function PlayerTable({
  grouped,
  display,
  flat,
  positionalRanks,
  dispatch,
  reorderable,
  onAddTier,
  onRemoveEmpty,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Only player rows are sortable; tier headers move via their ▲/▼ buttons and
  // empty-tier dividers are plain droppables (registered in EmptyTier).
  const orderedIds: string[] = [];
  if (grouped) {
    for (const g of display) {
      if (g.kind === "tier") g.players.forEach((p) => orderedIds.push(p.id));
    }
  } else {
    flat.forEach((p) => orderedIds.push(p.id));
  }

  // First/last tier (by display order) so the move arrows can disable at edges.
  const tierNums = display
    .filter(
      (g): g is Extract<DisplayGroup, { kind: "tier" }> => g.kind === "tier",
    )
    .map((g) => g.tier);
  const firstTier = tierNums[0];
  const lastTier = tierNums[tierNums.length - 1];

  const onDragEnd = (e: DragEndEvent) => {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || active === over) return;

    // Dropping a player into an empty tier slot → it becomes its own new tier.
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

    // Player onto player (re-tiers across a divider as before).
    dispatch({ type: "move", activeId: active, overId: over });
  };

  const renderRow = (p: Player, startsTier: boolean) => (
    <PlayerRow
      key={p.id}
      player={p}
      positionalRank={positionalRanks[p.id]}
      draggable={reorderable}
      startsTier={startsTier}
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
          <tr>
            <th className="col-mover"></th>
            <th className="col-draft">Draft</th>
            <th className="col-flag">{"★/⚑"}</th>
            <th className="col-rank">#</th>
            <th className="col-name">Player</th>
            <th className="col-pos">Pos</th>
            <th className="col-team">Team</th>
            <th className="col-adp">ADP</th>
            <th className="col-bye">Bye</th>
            <th className="col-notes">Notes</th>
          </tr>
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
                      onRemove={onRemoveEmpty}
                    />
                  ) : (
                    <TierHeaderGroup
                      key={`tier:${g.tier}`}
                      group={g}
                      editable={reorderable}
                      isFirst={g.tier === firstTier}
                      isLast={g.tier === lastTier}
                      dispatch={dispatch}
                      renderRow={renderRow}
                    />
                  ),
                )
              : flat.map((p) => renderRow(p, false))}
          </SortableContext>
        </tbody>
      </table>
    </DndContext>
  );
}

function TierHeaderGroup({
  group,
  editable,
  isFirst,
  isLast,
  dispatch,
  renderRow,
}: {
  group: Extract<DisplayGroup, { kind: "tier" }>;
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
  dispatch: Dispatch<Action>;
  renderRow: (p: Player, startsTier: boolean) => ReactNode;
}) {
  return (
    <>
      <TierHeader
        tier={group.tier}
        displayTier={group.displayTier}
        editable={editable}
        isFirst={isFirst}
        isLast={isLast}
        onMove={(t, dir) =>
          dispatch({ type: "moveTier", fromTier: t, toTier: t + dir })
        }
        onRemove={(t) => dispatch({ type: "removeTier", tier: t })}
      />
      {group.players.map((p, i) => renderRow(p, i === 0))}
    </>
  );
}

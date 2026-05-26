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
import type { Player } from "../types";
import type { TierGroup as TG } from "../lib/ranking";
import type { Action } from "../state/reducer";
import { PlayerRow } from "./PlayerRow";
import { TierGroup } from "./TierGroup";

interface Props {
  grouped: boolean;
  groups: TG[];
  flat: Player[];
  positionalRanks: Record<string, number>;
  dispatch: Dispatch<Action>;
  reorderable: boolean;
}

export function PlayerTable({
  grouped,
  groups,
  flat,
  positionalRanks,
  dispatch,
  reorderable,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const orderedIds = grouped
    ? groups.flatMap((g) => g.players.map((p) => p.id))
    : flat.map((p) => p.id);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      dispatch({
        type: "move",
        activeId: String(active.id),
        overId: String(over.id),
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <table className="players">
        <thead>
          <tr>
            <th></th>
            <th>#</th>
            <th>{"★/⚑"}</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th>Bye</th>
            <th>Tier</th>
            <th>ADP</th>
            <th>Notes</th>
            <th>Drafted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <SortableContext
            items={orderedIds}
            strategy={verticalListSortingStrategy}
          >
            {grouped
              ? groups.map((g) => (
                  <TierGroup
                    key={String(g.tier)}
                    tier={g.tier}
                    players={g.players}
                    positionalRanks={positionalRanks}
                    dispatch={dispatch}
                    draggable={reorderable}
                  />
                ))
              : flat.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    positionalRank={positionalRanks[p.id]}
                    draggable={false}
                    dispatch={dispatch}
                  />
                ))}
          </SortableContext>
        </tbody>
      </table>
    </DndContext>
  );
}

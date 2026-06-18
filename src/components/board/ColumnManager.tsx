import { useEffect, useRef, type CSSProperties } from "react";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { COLUMN_DEFS, type ColumnDef, type ColumnId } from "../../lib/columns";
import { foldRegistry, type ColumnLayout } from "../../lib/columnLayout";

interface Props {
  layout: ColumnLayout;
  onToggle: (id: ColumnId) => void;
  onReorder: (id: ColumnId, beforeId: ColumnId) => void;
  onReset: () => void;
  onClose: () => void;
}

const BY_ID = new Map<ColumnId, ColumnDef>(COLUMN_DEFS.map((c) => [c.id, c]));

// Human-friendly names for columns whose header label is empty or a glyph, so
// checkbox aria-labels (and the visible row text) read sensibly.
const FRIENDLY: Partial<Record<ColumnId, string>> = {
  mover: "Reorder",
  flag: "◎/⚑",
};

function labelFor(def: ColumnDef): string {
  return FRIENDLY[def.id] ?? def.label ?? def.id;
}

export function ColumnManager({
  layout,
  onToggle,
  onReorder,
  onReset,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const { order, hidden } = foldRegistry(layout);
  const hide = new Set(hidden);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      onReorder(active.id as ColumnId, over.id as ColumnId);
    }
  };

  return (
    <div className="col-manager" ref={ref}>
      <div className="col-manager-head">
        <span className="col-manager-title">Columns</span>
        <button className="col-manager-done" onClick={onClose}>
          Done
        </button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="col-manager-list">
            {order.map((id) => {
              const def = BY_ID.get(id);
              if (!def) return null;
              return (
                <ColumnManagerRow
                  key={id}
                  def={def}
                  visible={!hide.has(id)}
                  onToggle={onToggle}
                />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <button className="col-manager-reset" onClick={onReset}>
        Reset to default
      </button>
    </div>
  );
}

function ColumnManagerRow({
  def,
  visible,
  onToggle,
}: {
  def: ColumnDef;
  visible: boolean;
  onToggle: (id: ColumnId) => void;
}) {
  const locked = !!def.locked;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: def.id, disabled: locked });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const name = labelFor(def);

  return (
    <li ref={setNodeRef} style={style} className="col-manager-row">
      {locked ? (
        <span className="col-manager-grip locked" aria-hidden>
          🔒
        </span>
      ) : (
        <span
          className="col-manager-grip"
          aria-label={`Drag ${name}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>
      )}
      <label className="col-manager-label">
        <input
          type="checkbox"
          aria-label={name}
          checked={visible}
          disabled={locked}
          onChange={() => onToggle(def.id)}
        />{" "}
        {name}
      </label>
    </li>
  );
}

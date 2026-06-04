import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";

interface TierHeaderProps {
  tier: number;
  displayTier: number;
  count: number;
  colSpan: number;
  editable: boolean;
  onRemove: (tier: number) => void;
}

export function TierHeader({
  tier,
  displayTier,
  count,
  colSpan,
  editable,
  onRemove,
}: TierHeaderProps) {
  return (
    <tr className="tier-divider">
      <td colSpan={colSpan}>
        <div className="tier-banner">
          <span className="tier-label">Tier {displayTier}</span>
          <span className="tier-count">
            · {count} player{count === 1 ? "" : "s"}
          </span>
          {editable && tier !== 1 && (
            <span className="tier-tools">
              <button
                className="tier-remove"
                title="Remove tier — its players merge into the tier above"
                onClick={() => onRemove(tier)}
              >
                ✕
              </button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

interface TierBreakRowProps {
  breakId: string;
  displayTier: number;
  count: number; // players in the tier BELOW this break
  colSpan: number;
  editable: boolean;
  onRemove: (breakId: string) => void;
}

// A tier boundary that participates in the sortable list. When editable, it can
// be grabbed by its ⠿ handle and dragged through the player list — only the
// break moves, re-tiering the players it crosses (players never reorder).
export function TierBreakRow({
  breakId,
  displayTier,
  count,
  colSpan,
  editable,
  onRemove,
}: TierBreakRowProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: breakId, disabled: !editable });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style} className="tier-divider">
      <td colSpan={colSpan}>
        <div className="tier-banner">
          {editable && (
            <span
              className="tier-grip drag-handle"
              title="Drag to move this tier break"
              {...attributes}
              {...listeners}
            >
              ⠿
            </span>
          )}
          <span className="tier-label">Tier {displayTier}</span>
          <span className="tier-count">
            {count > 0
              ? ` · ${count} player${count === 1 ? "" : "s"}`
              : " · empty"}
          </span>
          {editable && (
            <span className="tier-tools">
              <button
                className="tier-remove"
                title="Remove this tier break"
                onClick={() => onRemove(breakId)}
              >
                ✕
              </button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

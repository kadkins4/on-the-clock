import { useDroppable } from "@dnd-kit/core";

const COLSPAN = 10;

interface TierHeaderProps {
  tier: number; // persisted tier number
  displayTier: number; // label shown to the user (counts empty tiers)
  editable: boolean;
  isFirst: boolean; // top-most tier (can't move up; Tier 1 can't be removed)
  isLast: boolean; // bottom-most tier (can't move down)
  onMove: (tier: number, dir: -1 | 1) => void;
  onRemove: (tier: number) => void;
}

export function TierHeader({
  tier,
  displayTier,
  editable,
  isFirst,
  isLast,
  onMove,
  onRemove,
}: TierHeaderProps) {
  return (
    <tr className="tier-divider">
      <td colSpan={COLSPAN}>
        <span className="tier-label">Tier {displayTier}</span>
        {editable && (
          <span className="tier-tools">
            <button
              className="tier-move"
              title="Move this tier up"
              disabled={isFirst}
              onClick={() => onMove(tier, -1)}
            >
              ▲
            </button>
            <button
              className="tier-move"
              title="Move this tier down"
              disabled={isLast}
              onClick={() => onMove(tier, 1)}
            >
              ▼
            </button>
            {tier !== 1 && (
              <button
                className="tier-remove"
                title="Remove tier — its players merge into the tier above"
                onClick={() => onRemove(tier)}
              >
                ✕
              </button>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

interface EmptyTierProps {
  anchorId: string; // sits directly above this player
  displayTier: number;
  onRemove: (anchorId: string) => void;
}

export function EmptyTier({ anchorId, displayTier, onRemove }: EmptyTierProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `empty:${anchorId}` });
  return (
    <tr
      ref={setNodeRef}
      className={`tier-divider empty-tier${isOver ? " drop-over" : ""}`}
    >
      <td colSpan={COLSPAN}>
        <span className="tier-label">
          Tier {displayTier} · empty — drop a player here
        </span>
        <span className="tier-tools">
          <button
            className="tier-remove"
            title="Discard this empty tier"
            onClick={() => onRemove(anchorId)}
          >
            ✕
          </button>
        </span>
      </td>
    </tr>
  );
}

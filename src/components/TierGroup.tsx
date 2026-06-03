import { useDroppable } from "@dnd-kit/core";

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

interface EmptyTierProps {
  anchorId: string;
  displayTier: number;
  colSpan: number;
  onRemove: (anchorId: string) => void;
}

export function EmptyTier({
  anchorId,
  displayTier,
  colSpan,
  onRemove,
}: EmptyTierProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `empty:${anchorId}` });
  return (
    <tr
      ref={setNodeRef}
      className={`tier-divider empty-tier${isOver ? " drop-over" : ""}`}
    >
      <td colSpan={colSpan}>
        <div className="tier-banner">
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
        </div>
      </td>
    </tr>
  );
}

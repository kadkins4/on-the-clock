import type { Player } from "../../types";

interface Props {
  players: Player[]; // already resolved, ordered, and pending (drafted dropped)
  canDraft: boolean;
  onDraft: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenPlayer: (id: string) => void;
}

// B5: My Queue panel. The user's starred players, in queue order, with the
// already-drafted ones filtered out by the caller (pendingQueue). Draft or
// remove straight from the panel. B6 will relocate this into the Desk's left
// column; for now it lives in the DRAFT tab.
export function MyQueue({
  players,
  canDraft,
  onDraft,
  onRemove,
  onOpenPlayer,
}: Props) {
  return (
    <div className="myqueue">
      <div className="myqueue-head">My Queue</div>
      {players.length === 0 ? (
        <div className="myqueue-empty">Star players to build your queue</div>
      ) : (
        <div className="myqueue-list">
          {players.map((p) => (
            <div key={p.id} className={`myqueue-row pos-${p.position}`}>
              <button
                className="myqueue-name"
                onClick={() => onOpenPlayer(p.id)}
              >
                {p.name}
              </button>
              <span className="myqueue-meta">
                {p.position} · ADP{" "}
                {p.adp == null ? "—" : Number(p.adp.toFixed(1))}
              </span>
              <button
                className="myqueue-draft"
                disabled={!canDraft}
                title={`Draft ${p.name}`}
                onClick={() => onDraft(p.id)}
              >
                Draft
              </button>
              <button
                className="myqueue-remove"
                title={`Remove ${p.name} from queue`}
                onClick={() => onRemove(p.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

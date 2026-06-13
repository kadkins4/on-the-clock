import type { Player } from "../../types";
import type { PlayerDraftStatus } from "../../lib/mock/playerDraftStatus";

interface Props {
  players: Player[]; // full pool, filtered by the position chip
  canDraft: boolean;
  draftStatusOf: (id: string) => PlayerDraftStatus & { initials?: string };
  onDraft: (id: string) => void;
  onOpenPlayer: (id: string) => void;
  /** When provided, each row shows a ★ queue toggle (no drag / drafted / avoid). */
  queuedIds?: ReadonlySet<string>;
  onToggleQueue?: (id: string) => void;
}

// ④b The mock-draft "Players" tab as a dense research table — distinct from
// the Draft tab's carded Best-Available list. Star-to-queue + a STATUS column
// (DRAFT button while available, pick · team once taken); no drag, no drafted
// toggle, no avoid flag.
export function MockPlayersTable({
  players,
  canDraft,
  draftStatusOf,
  onDraft,
  onOpenPlayer,
  queuedIds,
  onToggleQueue,
}: Props) {
  return (
    <table className="mpt">
      <thead>
        <tr>
          {onToggleQueue && <th className="mpt-star-col" aria-label="Queue" />}
          <th className="mpt-c">#</th>
          <th className="mpt-l">PLAYER</th>
          <th className="mpt-c">POS</th>
          <th className="mpt-c">TEAM</th>
          <th className="mpt-c">ADP</th>
          <th className="mpt-c">PROJ</th>
          <th className="mpt-c">BYE</th>
          <th className="mpt-c">STATUS</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const ds = draftStatusOf(p.id);
          const isDrafted = ds.drafted === true;
          const queued = queuedIds?.has(p.id) ?? false;
          return (
            <tr
              key={p.id}
              className={`mpt-row pos-${p.position}${isDrafted ? " mpt-row--drafted" : ""}`}
            >
              {onToggleQueue && (
                <td className="mpt-star-col">
                  <button
                    className={`mpt-star${queued ? " on" : ""}`}
                    title={
                      queued
                        ? `Remove ${p.name} from queue`
                        : `Add ${p.name} to queue`
                    }
                    aria-pressed={queued}
                    onClick={() => onToggleQueue(p.id)}
                  >
                    {queued ? "★" : "☆"}
                  </button>
                </td>
              )}
              <td className="mpt-c mpt-rank">{p.overallRank}</td>
              <td className="mpt-l">
                <button className="mpt-name" onClick={() => onOpenPlayer(p.id)}>
                  {p.name}
                </button>
              </td>
              <td className="mpt-c">
                <span className="mpt-pos">{p.position}</span>
              </td>
              <td className="mpt-c mpt-mono">{p.team}</td>
              <td className="mpt-c mpt-mono">
                {p.adp == null ? "—" : Number(p.adp.toFixed(1))}
              </td>
              <td className="mpt-c mpt-mono">
                {p.projPoints == null ? "—" : p.projPoints.toFixed(1)}
              </td>
              <td className="mpt-c mpt-mono">{p.byeWeek ?? "—"}</td>
              <td className="mpt-c mpt-status-cell">
                {isDrafted && ds.drafted ? (
                  <span className="mpt-status">
                    {ds.pickLabel} · {ds.initials ?? ""}
                  </span>
                ) : (
                  <button
                    className="mpt-draft"
                    disabled={!canDraft}
                    title={`Draft ${p.name}`}
                    onClick={() => onDraft(p.id)}
                  >
                    DRAFT
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

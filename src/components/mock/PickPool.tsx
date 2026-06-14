import { useState } from "react";
import type { Player } from "../../types";
import type { PlayerDraftStatus } from "../../lib/mock/playerDraftStatus";
import { formatVor } from "../../lib/vor";

export type PoolCol = "bye" | "proj" | "vor";
export const POOL_COL_CAP = 3;

interface Props {
  players: Player[]; // filtered by position chip; available-only OR full pool
  canDraft: boolean;
  overall: number;
  extraCols: PoolCol[];
  onDraft: (id: string) => void;
  onOpenPlayer: (id: string) => void;
  /**
   * When provided, PickPool is in "research mode" (Players tab).
   * Called per row — if the returned status has `drafted: true`, the row is
   * dimmed and shows "pickLabel · teamInitials" instead of the ＋ DRAFT button.
   * When absent (Draft tab), all rows render as available.
   */
  draftStatusOf?: (id: string) => PlayerDraftStatus & { initials?: string };
  /**
   * When provided, each row shows a ★ queue toggle (B5). `queuedIds` marks the
   * currently-queued players. Absent → no star (other usages unaffected).
   */
  queuedIds?: ReadonlySet<string>;
  onToggleQueue?: (id: string) => void;
  /**
   * Scored PROJ / VOR maps (player id → value) for the `proj` / `vor` extra
   * columns. Absent → those columns render "—".
   */
  projById?: Record<string, number | null>;
  vorById?: Record<string, number | null>;
}

// Group consecutive players by tier (players arrive in overall-rank order).
function groupByTier(
  players: Player[],
): { tier: number | null; players: Player[] }[] {
  const out: { tier: number | null; players: Player[] }[] = [];
  for (const p of players) {
    const last = out[out.length - 1];
    if (last && last.tier === p.tier) last.players.push(p);
    else out.push({ tier: p.tier, players: [p] });
  }
  return out;
}

export function PickPool({
  players,
  canDraft,
  extraCols,
  onDraft,
  onOpenPlayer,
  draftStatusOf,
  queuedIds,
  onToggleQueue,
  projById,
  vorById,
}: Props) {
  const groups = groupByTier(players);
  const [note, setNote] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="pickpool">
      {groups.map((g, i) => (
        <div key={i}>
          <div className="pp-tier">
            Tier {g.tier ?? "—"}{" "}
            <span className="pp-cnt">· {g.players.length}</span>
          </div>
          {g.players.map((p) => {
            const ds = draftStatusOf?.(p.id);
            const isDrafted = ds?.drafted === true;
            const proj = projById?.[p.id];
            return (
              <div
                key={p.id}
                className={`pp-row pos-${p.position} flag-${p.flag}${isDrafted ? " pp-row--drafted" : ""}`}
              >
                <span className="pp-rank">{p.overallRank}</span>
                {onToggleQueue && (
                  <button
                    className={`pp-star${queuedIds?.has(p.id) ? " on" : ""}`}
                    title={
                      queuedIds?.has(p.id)
                        ? `Remove ${p.name} from queue`
                        : `Add ${p.name} to queue`
                    }
                    aria-pressed={queuedIds?.has(p.id) ?? false}
                    onClick={() => onToggleQueue(p.id)}
                  >
                    {queuedIds?.has(p.id) ? "★" : "☆"}
                  </button>
                )}
                <span className="pp-pos">{p.position}</span>
                <button className="pp-name" onClick={() => onOpenPlayer(p.id)}>
                  {p.name}
                </button>
                <span className="pp-meta">
                  {p.team} · BYE {p.byeWeek ?? "—"}
                </span>
                {p.flag !== "none" && (
                  <span className={`pp-flag ${p.flag}`} title={p.flag}>
                    {p.flag === "target" ? "★" : "⊘"}
                  </span>
                )}
                {p.notes?.trim() && (
                  <span
                    className="pp-note"
                    title="Read note"
                    onClick={(e) => {
                      const r = (
                        e.target as HTMLElement
                      ).getBoundingClientRect();
                      const x = Math.min(r.left, window.innerWidth - 240);
                      setNote({
                        text: p.notes,
                        x: Math.max(8, x),
                        y: r.bottom + 6,
                      });
                    }}
                  >
                    📝
                  </span>
                )}
                {!isDrafted && (
                  <span className="pp-adp">
                    {p.adp == null ? "" : `ADP ${Number(p.adp.toFixed(1))}`}
                  </span>
                )}
                {extraCols.includes("bye") && (
                  <span className="pp-x">{p.byeWeek ?? "—"}</span>
                )}
                {extraCols.includes("proj") && (
                  <span className="pp-x">
                    {proj == null ? "—" : proj.toFixed(1)}
                  </span>
                )}
                {extraCols.includes("vor") && (
                  <span className="pp-x">{formatVor(vorById?.[p.id])}</span>
                )}
                {isDrafted && ds.drafted ? (
                  <span className="pp-status">
                    {ds.pickLabel} · {ds.initials ?? ""}
                  </span>
                ) : (
                  <button
                    className="pp-draft"
                    disabled={!canDraft}
                    title={`Draft ${p.name}`}
                    onClick={() => onDraft(p.id)}
                  >
                    DRAFT
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {note && (
        <>
          <div className="pp-note-scrim" onClick={() => setNote(null)} />
          <div className="pp-note-pop" style={{ left: note.x, top: note.y }}>
            <div className="pp-note-lbl">Your note</div>
            {note.text}
          </div>
        </>
      )}
    </div>
  );
}

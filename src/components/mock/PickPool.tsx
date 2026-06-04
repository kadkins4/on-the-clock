import { useState } from "react";
import type { Player } from "../../types";

export type PoolCol = "bye" | "proj" | "vor";
export const POOL_COL_CAP = 3;

interface Props {
  players: Player[]; // already filtered by position chip, available
  canDraft: boolean;
  overall: number;
  extraCols: PoolCol[];
  onToggleCol: (c: PoolCol) => void;
  onDraft: (id: string) => void;
  onOpenPlayer: (id: string) => void;
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
  onToggleCol,
  onDraft,
  onOpenPlayer,
}: Props) {
  const groups = groupByTier(players);
  const [note, setNote] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const atCap = extraCols.length >= POOL_COL_CAP;

  return (
    <div className="pickpool">
      {/* Column toggle bar */}
      <div className="pp-colbar">
        <span>Columns:</span>
        {(["bye", "proj", "vor"] as PoolCol[]).map((c) => {
          const on = extraCols.includes(c);
          const comingSoon = c === "proj" || c === "vor";
          return (
            <button
              key={c}
              className={on ? "on" : ""}
              disabled={comingSoon || (!on && atCap)}
              title={comingSoon ? "Coming soon" : undefined}
              onClick={() => onToggleCol(c)}
            >
              {c === "bye" ? "Bye" : c === "proj" ? "Proj" : "VOR"}
            </button>
          );
        })}
      </div>

      {groups.map((g, i) => (
        <div key={i}>
          <div className="pp-tier">
            Tier {g.tier ?? "—"}{" "}
            <span className="pp-cnt">· {g.players.length}</span>
          </div>
          {g.players.map((p) => (
            <div
              key={p.id}
              className={`pp-row pos-${p.position} flag-${p.flag}`}
            >
              <span className="pp-pos">{p.position}</span>
              <button className="pp-name" onClick={() => onOpenPlayer(p.id)}>
                {p.name}
              </button>
              <span className="pp-team">· {p.team}</span>
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
                    const r = (e.target as HTMLElement).getBoundingClientRect();
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
              <span className="pp-adp">
                {p.adp == null ? "" : `ADP ${Number(p.adp.toFixed(1))}`}
              </span>
              {extraCols.includes("bye") && (
                <span className="pp-x">{p.byeWeek ?? "—"}</span>
              )}
              <button
                className="pp-draft"
                disabled={!canDraft}
                title={`Draft ${p.name}`}
                onClick={() => onDraft(p.id)}
              >
                ＋
              </button>
            </div>
          ))}
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

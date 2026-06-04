import type { Player } from "../../types";

interface Props {
  players: Player[]; // already filtered by position chip, available
  canDraft: boolean;
  overall: number;
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

export function PickPool({ players, canDraft, onDraft, onOpenPlayer }: Props) {
  const groups = groupByTier(players);
  return (
    <div className="pickpool">
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
                  title="Has a note"
                  data-note={p.notes}
                >
                  📝
                </span>
              )}
              <span className="pp-adp">
                {p.adp == null ? "" : `ADP ${Number(p.adp.toFixed(1))}`}
              </span>
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
    </div>
  );
}

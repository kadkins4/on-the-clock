import type { MockSummaryResult } from "../../lib/mock/summary";
import { formatPick } from "../../lib/mock/board";

interface Props {
  summary: MockSummaryResult;
  teams: number;
  onRestart: () => void;
  onExit: () => void;
}

export function MockSummary({ summary, teams, onRestart, onExit }: Props) {
  const counts = Object.entries(summary.positionCounts)
    .map(([pos, n]) => `${pos} ${n}`)
    .join(" · ");
  return (
    <div className="mock-summary">
      <h2>Your team</h2>
      <div className="mock-counts">{counts}</div>
      <div className="summary-roster">
        {summary.players.map((p) => (
          <div key={p.id} className={`summary-card pos-${p.position}`}>
            <div className="summary-card-top">
              <span className="summary-pos">{p.position}</span>
              <span className="summary-pick">
                {formatPick(p.overallPick, teams)}
              </span>
            </div>
            <div className="summary-name">{p.name}</div>
            <div className="summary-meta">
              {p.team}
              {p.adpFlag != null && p.adpDelta != null && (
                // adpFlag is set by mockSummary (per-list threshold, off when
                // disabled). reach = drafted earlier than ADP; value = later.
                <span
                  className={`mock-delta ${p.adpFlag}`}
                  title="How far from ADP you drafted them — only shown when a full round or more off (reach = earlier than ADP, value = later)"
                >
                  {" "}
                  · {p.adpFlag} {Math.abs(Math.round(p.adpDelta))}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mock-actions">
        <button onClick={onRestart}>New mock</button>
        <button className="secondary" onClick={onExit}>
          Back to board
        </button>
      </div>
    </div>
  );
}

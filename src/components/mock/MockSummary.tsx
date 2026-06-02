import type { MockSummaryResult } from "../../lib/mock/summary";

interface Props {
  summary: MockSummaryResult;
  onRestart: () => void;
  onExit: () => void;
}

export function MockSummary({ summary, onRestart, onExit }: Props) {
  const counts = Object.entries(summary.positionCounts)
    .map(([pos, n]) => `${pos} ${n}`)
    .join(" · ");
  return (
    <div className="mock-summary">
      <h2>Your team</h2>
      <div className="mock-counts">{counts}</div>
      <ol className="mock-roster">
        {summary.players.map((p) => (
          <li key={p.id}>
            <span className="mock-pick">#{p.overallPick}</span>
            <span className="mock-name">{p.name}</span>
            <span className="mock-pos">{p.position}</span>
            <span className="mock-team">{p.team}</span>
            {p.adpFlag != null && p.adpDelta != null && (
              // Only flagged when at least a full round off ADP (see adpFlag).
              // reach = drafted earlier than ADP; value = later (fell to you).
              <span
                className={`mock-delta ${p.adpFlag}`}
                title="How far from ADP you drafted them — only shown when a full round or more off (reach = earlier than ADP, value = later)"
              >
                {p.adpFlag} {Math.abs(Math.round(p.adpDelta))}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mock-actions">
        <button onClick={onRestart}>New mock</button>
        <button className="secondary" onClick={onExit}>
          Back to board
        </button>
      </div>
    </div>
  );
}

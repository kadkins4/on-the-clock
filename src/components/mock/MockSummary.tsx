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
            {p.adpDelta != null && p.adpDelta !== 0 && (
              // adpDelta = adp - pick. Positive → you took them earlier than
              // their ADP (a reach); negative → later than ADP (a value).
              <span
                className={
                  p.adpDelta > 0 ? "mock-delta reach" : "mock-delta value"
                }
                title="How far from ADP you drafted them — reach = earlier than ADP, value = later"
              >
                {p.adpDelta > 0
                  ? `reach ${p.adpDelta.toFixed(0)}`
                  : `value ${Math.abs(p.adpDelta).toFixed(0)}`}
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

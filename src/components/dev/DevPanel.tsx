import type { Player } from "../../types";
import type { RefetchResult, LoggedError } from "../../lib/storage";
import type { SourcesMeta } from "../../lib/sources/types";
import { dataQualityIssues } from "../../lib/dataQuality";

interface Props {
  players: Player[];
  refetch: RefetchResult | null;
  errors: LoggedError[];
  sourcesMeta: SourcesMeta | null;
  sourcesFetchedAt: number;
  onClearErrors: () => void;
  onResetBoard: () => void;
  onClose: () => void;
}

const fmt = (ms: number) => new Date(ms).toLocaleString();

// Gated (?dev=1) per-device diagnostics: last refetch/shape result, computed
// data-quality gaps, the buffered runtime-error log, and the destructive Reset.
export function DevPanel({
  players,
  refetch,
  errors,
  sourcesMeta,
  sourcesFetchedAt,
  onClearErrors,
  onResetBoard,
  onClose,
}: Props) {
  const issues = dataQualityIssues(players);
  return (
    <div className="dev-panel">
      <header className="dev-head">
        <h1>Diagnostics</h1>
        <button onClick={onClose}>← Back to board</button>
      </header>

      <section>
        <h2>Last refetch</h2>
        {refetch ? (
          <p>
            {refetch.ok ? "✓ OK" : "✗ Failed"} · {fmt(refetch.at)} ·{" "}
            {refetch.ok
              ? `${refetch.count ?? "?"} players`
              : `${refetch.reason} (${refetch.fingerprint})`}
          </p>
        ) : (
          <p className="muted">No refetch recorded.</p>
        )}
      </section>

      <section>
        <h2>Player source data</h2>
        {sourcesMeta ? (
          <p>
            {sourcesMeta.count} players ·{" "}
            {sourcesMeta.sources.join(" + ") || "—"} · season{" "}
            {sourcesMeta.season}
            {sourcesFetchedAt > 0 && ` · ${fmt(sourcesFetchedAt)}`}
          </p>
        ) : (
          <p className="muted">
            None gathered yet — run “Refresh data &amp; ADP”.
          </p>
        )}
      </section>

      <section>
        <h2>Data quality ({issues.length})</h2>
        {issues.length === 0 ? (
          <p className="muted">No gaps on the current board.</p>
        ) : (
          <ul className="dev-list">
            {issues.map((i) => (
              <li key={i.id}>
                {i.name} — {i.problems.join(", ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Runtime errors ({errors.length})</h2>
        <p className="muted">
          Remote reporting:{" "}
          {import.meta.env.VITE_FORMSPREE_ENDPOINT ? "on" : "off (local only)"}
        </p>
        {errors.length > 0 && (
          <button onClick={onClearErrors}>Clear errors</button>
        )}
        <ul className="dev-list">
          {errors.map((e, i) => (
            <li key={i}>
              <code>{e.source}</code> · {fmt(e.at)} — {e.message}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Danger zone</h2>
        <button
          className="dev-danger"
          onClick={() => {
            if (confirm("Reset everything? This wipes tiers, flags & notes."))
              onResetBoard();
          }}
        >
          ⤺ Reset board
        </button>
      </section>
    </div>
  );
}

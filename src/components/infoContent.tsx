// Static copy for the About and Log pages. Kept apart from the page chrome
// (InfoPage) so wording can change without touching layout. The Change Log is
// hand-maintained: list feature-level changes by date (new or removed
// features), not minor styling tweaks.

export function AboutContent() {
  return (
    <>
      <p>
        A draft-day cheat sheet that stays out of your way. Build tiers, mark
        targets, and track every pick on a single fast board — no logins, your
        data lives in your browser.
      </p>
      <ul>
        <li>Custom tiers &amp; target flags you control</li>
        <li>A multi-source ADP blend you can refresh live</li>
        <li>Mock drafts to rehearse your strategy</li>
        <li>Per-league columns, scoring, and rosters</li>
      </ul>
    </>
  );
}

export function LogContent() {
  return (
    <>
      <section className="otc-log-section">
        <h2 className="otc-log-h">Road Map</h2>
        <ul className="otc-log">
          <li>
            <b>Live draft mode</b> — in-draft tools to manage your real draft as
            it happens.
          </li>
          <li>
            <b>Guided onboarding</b> — a quick tour so first-timers know where
            to start.
          </li>
          <li>
            <b>Smarter mocks</b> — opponent personalities and post-draft
            insights.
          </li>
        </ul>
      </section>

      <section className="otc-log-section">
        <h2 className="otc-log-h">Change Log</h2>
        <ul className="otc-changelog">
          <li>
            <span className="otc-log-date">Jun 5, 2026</span>
            New header with About and Log (road map &amp; change log) pages.
          </li>
          <li>
            <span className="otc-log-date">Jun 5, 2026</span>
            Multi-source ADP blend — FantasyPros and Yahoo added alongside ESPN
            and FFC.
          </li>
          <li>
            <span className="otc-log-date">Jun 4, 2026</span>
            Draggable tier breaks — split and reorder tiers right on the board;
            mock-draft visual overhaul with auto-draft.
          </li>
          <li>
            <span className="otc-log-date">Jun 3, 2026</span>
            Column manager — show/hide and drag-reorder columns; added
            Projections and last-season stats.
          </li>
          <li>
            <span className="otc-log-date">Jun 2, 2026</span>
            Value Over Replacement (VOR) column; an &ldquo;On The Clock&rdquo;
            moment in mock drafts.
          </li>
          <li>
            <span className="otc-log-date">Jun 1, 2026</span>
            Mock-draft board grid; multiple tier lists per league.
          </li>
          <li>
            <span className="otc-log-date">May 31, 2026</span>
            Multi-league support with scoring and rosters; live ADP refresh;
            mock-draft engine.
          </li>
          <li>
            <span className="otc-log-date">May 27, 2026</span>
            Core cheat sheet — ESPN data, tiers, smart search, CSV/JSON
            import-export, injury badges, bye-week filter.
          </li>
        </ul>
      </section>
    </>
  );
}

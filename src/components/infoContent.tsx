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
            <span className="otc-log-date">Jul 11, 2026</span>
            More bot personalities &amp; a custom bot mix — four new draft
            strategies join the pool: Prospector (chases youth &amp; rookies),
            Proven Vet (trusts established vets), Value Sniper (pounces when the
            board rates a player above his ADP) and Stacker (pairs a QB with his
            own pass-catchers). In the lobby&rsquo;s Advanced options you can
            now set a custom bot mix — dial in how many bots run each strategy,
            add personality-free &ldquo;Normal&rdquo; bots, or leave it on
            random.
          </li>
          <li>
            <span className="otc-log-date">Jul 10, 2026</span>
            Bot personalities &amp; strategy coach — mock-draft bots now draft
            with distinct strategies (Hero RB, Zero RB, Robust RB, Streamer,
            Balanced), revealed at the end of the draft. As you pick, a coach
            reads the strategy you&rsquo;re running and suggests what to target
            next. Toggle personalities off in the lobby for straight
            best-available bots.
          </li>
          <li>
            <span className="otc-log-date">Jun 16, 2026</span>
            Sleeper ADP in the blend — the board’s ADP now folds in Sleeper’s
            real-draft average draft position alongside
            FantasyFootballCalculator, FantasyPros and Yahoo, for a more
            accurate consensus (especially in the middle rounds).
          </li>
          <li>
            <span className="otc-log-date">Jun 16, 2026</span>
            More data sources — the data refresh now gathers Sleeper
            projections/ADP, FantasyCalc values, DynastyProcess draft pedigree,
            and nflverse last-season advanced stats (target share, air yards,
            EPA) behind the scenes, building a richer per-player dataset for
            upcoming player cards.
          </li>
          <li>
            <span className="otc-log-date">Jun 15, 2026</span>
            One-tap data refresh — “Refresh data &amp; ADP” now pulls the latest
            players and projections from ESPN and blends fresh ADP (FFC,
            FantasyPros, Yahoo) in a single step, with Yahoo now covering the
            full player list instead of just the top 25.
          </li>
          <li>
            <span className="otc-log-date">Jun 14, 2026</span>
            Toast notifications — saves and refreshes now confirm with a small
            color-coded toast (green success, amber warning, red error) instead
            of a browser pop-up alert.
          </li>
          <li>
            <span className="otc-log-date">Jun 14, 2026</span>
            Linear draft format — pick Linear in the mock lobby to draft the
            same order (1&rarr;N) every round, no snake. Auction is still coming
            soon.
          </li>
          <li>
            <span className="otc-log-date">Jun 14, 2026</span>
            Mock lobby — a redesigned pre-draft screen with draft format,
            scoring, team count, rounds, a click-to-pick draft-slot board, and
            editable roster spots. Super Flex, TE Premium, and bot personalities
            are previewed as coming soon.
          </li>
          <li>
            <span className="otc-log-date">Jun 14, 2026</span>
            Mock PROJ &amp; VOR — the pick pool and player card now show
            projected points and value over replacement, scored at your
            league&rsquo;s settings. Toggle the Proj and VOR columns from the ⚙
            menu.
          </li>
          <li>
            <span className="otc-log-date">Jun 13, 2026</span>
            Fresh look — redesigned across the app with new typography, position
            colors, and roomier, easier-to-scan tables.
          </li>
          <li>
            <span className="otc-log-date">Jun 13, 2026</span>
            Draft room — mock drafts now run in a dedicated room with a player
            card overlay, a broadcast Desk, and two board views (The Wall &amp;
            Locker Room).
          </li>
          <li>
            <span className="otc-log-date">Jun 13, 2026</span>
            My Queue — star players to build an ordered queue that auto-drops
            each pick as it&rsquo;s taken.
          </li>
          <li>
            <span className="otc-log-date">Jun 13, 2026</span>
            TV mode — cast the draft to a second window with a live split-flap
            big board.
          </li>
          <li>
            <span className="otc-log-date">Jun 5, 2026</span>
            Undo — reverse recent board edits with the Undo button or
            &#8984;Z&nbsp;/&nbsp;Ctrl+Z.
          </li>
          <li>
            <span className="otc-log-date">Jun 5, 2026</span>
            Editable rank — double-click a player&rsquo;s rank to move them and
            shift everyone else.
          </li>
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

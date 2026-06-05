// Static copy for the header's About and Log modals. Kept apart from InfoModal
// (the chrome) so wording can change without touching modal behavior.

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
    <ul className="otc-log">
      <li>
        <b>Multi-source ADP</b> — blended ESPN, FantasyPros, FFC &amp; Yahoo.
      </li>
      <li>
        <b>Mock drafts</b> — rehearse against auto-drafting opponents.
      </li>
      <li>
        <b>Draggable tiers</b> — split and reorder tier breaks inline.
      </li>
      <li className="otc-log-next">
        <b>Coming next:</b> live draft mode.
      </li>
    </ul>
  );
}

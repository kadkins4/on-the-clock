import { Intro } from "./Intro";
import { Wordmark } from "./Wordmark";

// The stopwatch mark, same geometry as the intro splash so the brand the user
// just watched assemble carries straight into the hub hero. Sized by its
// wrapper; color inherits (accent) via currentColor on the ring/crown.
function StopwatchMark() {
  return (
    <svg className="otc-hub-mark" viewBox="0 0 64 64" aria-hidden="true">
      <circle
        className="ring"
        cx="32"
        cy="34"
        r="17"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <rect x="26" y="9" width="12" height="5" rx="2.5" fill="currentColor" />
      <g className="hands">
        <line
          x1="32"
          y1="34"
          x2="32"
          y2="23"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="34"
          x2="40"
          y2="38"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

type HubProps = {
  introReplay: number;
  onEnterMock: () => void;
  onEnterLive: () => void;
  onEnterPrep: () => void;
  onAbout: () => void;
  onLog: () => void;
};

// The launcher hub — the home screen every visit lands on (unless a ?mode=
// deep-link skips it). Three rooms in descending weight: Mock (hero banner),
// Live, Prep. Concept B "Center Marquee". Preview data is illustrative.
export function Hub({
  introReplay,
  onEnterMock,
  onEnterLive,
  onEnterPrep,
  onAbout,
  onLog,
}: HubProps) {
  return (
    <div className="otc-hub">
      <Intro replay={introReplay} />

      <header className="otc-hub-hero">
        <span className="otc-hub-brandmark">
          <StopwatchMark />
        </span>
        <h1 className="otc-hub-wordmark">
          <Wordmark />
        </h1>
        <p className="otc-hub-kicker">Pick your room</p>
      </header>

      <div className="otc-hub-marquee" aria-hidden="true">
        <div className="otc-hub-marquee-track">
          <span>
            <b>Mock</b> · 12-team PPR · pick 3.04
          </span>
          <span className="live">● Live · Sleeper draft · pick 24</span>
          <span>
            <b>Prep</b> · 340 players ranked · 14 tiers
          </span>
          <span>
            <b>Mock</b> · 12-team PPR · pick 3.04
          </span>
          <span className="live">● Live · Sleeper draft · pick 24</span>
          <span>
            <b>Prep</b> · 340 players ranked · 14 tiers
          </span>
        </div>
      </div>

      <div className="otc-hub-stack">
        {/* MOCK — hero banner */}
        <button
          type="button"
          className="otc-hub-tile mock"
          onClick={onEnterMock}
        >
          <div className="otc-hub-tile-body">
            <div className="otc-hub-tile-copy">
              <span className="otc-hub-eyebrow">
                Practice · vs bots or humans
              </span>
              <h2>Mock Draft</h2>
              <p>
                The fast, endless reps room. Full snake board, smart bots, your
                rules.
              </p>
              <span className="otc-hub-cta">Start a mock</span>
            </div>
            <div className="otc-hub-preview" aria-hidden="true">
              <div className="otc-hub-scoreboard">
                <span className="pk">3.04</span>
                <span className="otc">On the clock</span>
              </div>
              <div className="otc-hub-board">
                <span className="cell wr">1.01</span>
                <span className="cell rb">1.02</span>
                <span className="cell wr">1.03</span>
                <span className="cell rb">1.04</span>
                <span className="cell wr">1.05</span>
                <span className="cell te">1.06</span>
                <span className="cell rb">1.07</span>
                <span className="cell wr">1.08</span>
                <span className="cell rb">3.01</span>
                <span className="cell wr">3.02</span>
                <span className="cell qb">3.03</span>
                <span className="cell here">3.04</span>
                <span className="cell">3.05</span>
                <span className="cell">3.06</span>
                <span className="cell">3.07</span>
                <span className="cell">3.08</span>
              </div>
            </div>
          </div>
        </button>

        <div className="otc-hub-row">
          {/* LIVE — secondary */}
          <button
            type="button"
            className="otc-hub-tile live"
            onClick={onEnterLive}
          >
            <div className="otc-hub-tile-head">
              <span className="otc-hub-eyebrow">
                <span className="otc-hub-livedot" /> Broadcast your real draft
              </span>
              <span className="otc-hub-rank">Live</span>
            </div>
            <h2>Live Draft</h2>
            <div className="otc-hub-bcast">
              <span className="tag">
                <span className="otc-hub-livedot" /> On the clock · Pick 24
              </span>
              <div className="name">De'Von Achane</div>
              <div className="meta">
                <span className="poschip rb">RB</span> MIA · Bye 6 · ADP 21
              </div>
            </div>
            <div className="otc-hub-platforms">
              <span className="plat on">Sleeper ✓</span>
              <span className="plat soon">ESPN soon</span>
              <span className="plat soon">Yahoo soon</span>
            </div>
          </button>

          {/* PREP — tertiary */}
          <button
            type="button"
            className="otc-hub-tile prep"
            onClick={onEnterPrep}
          >
            <div className="otc-hub-tile-head">
              <span className="otc-hub-eyebrow">Rankings · tiers · notes</span>
              <span className="otc-hub-rank">Prep</span>
            </div>
            <h2>Prep Board</h2>
            <div className="otc-hub-cheat" aria-hidden="true">
              <div className="row">
                <span className="rk">1</span>
                <span className="nm">
                  <span className="dot wr" />
                  Ja'Marr Chase
                </span>
                <span className="adp">1.01</span>
              </div>
              <div className="row">
                <span className="rk">2</span>
                <span className="nm">
                  <span className="dot rb" />
                  Bijan Robinson
                </span>
                <span className="adp">1.02</span>
              </div>
              <div className="tier-break">Tier 2</div>
              <div className="row">
                <span className="rk">3</span>
                <span className="nm">
                  <span className="dot wr" />
                  Justin Jefferson
                </span>
                <span className="adp">1.04</span>
              </div>
              <div className="row">
                <span className="rk">4</span>
                <span className="nm">
                  <span className="dot te" />
                  Brock Bowers
                </span>
                <span className="adp">2.01</span>
              </div>
            </div>
            <span className="otc-hub-cta ghost">Open board</span>
          </button>
        </div>
      </div>

      <footer className="otc-hub-foot">
        <button type="button" onClick={onAbout}>
          About
        </button>
        <button type="button" onClick={onLog}>
          Change log
        </button>
        <span className="spacer" />
        <span className="ver">v2 · alpha</span>
      </footer>
    </div>
  );
}

// Placeholder room for Live Draft until the Sleeper adapter + broadcast view
// ship. Reachable from the hub's Live tile and ?mode=live.
export function LivePlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <div className="otc-hub otc-live-soon">
      <header className="otc-hub-hero">
        <span className="otc-hub-brandmark">
          <StopwatchMark />
        </span>
        <h1 className="otc-hub-wordmark">
          <Wordmark />
        </h1>
        <p className="otc-hub-kicker">Live Draft</p>
      </header>
      <div className="otc-live-soon-card">
        <span className="otc-hub-eyebrow">
          <span className="otc-hub-livedot" /> Coming soon
        </span>
        <h2>Broadcast your real draft</h2>
        <p>
          Connect a live draft and watch it play out on the big board, with the
          announcer calling every pick. Sleeper lands first (no login needed);
          ESPN and Yahoo follow.
        </p>
        <div className="otc-hub-platforms">
          <span className="plat on">Sleeper — first</span>
          <span className="plat soon">ESPN — later</span>
          <span className="plat soon">Yahoo — later</span>
        </div>
        <button type="button" className="otc-hub-cta ghost" onClick={onBack}>
          Back to hub
        </button>
      </div>
    </div>
  );
}

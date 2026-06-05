import { Wordmark } from "./Wordmark";

// The app header band: brand (logo + wordmark + tagline) on the left, the
// About / Log nav links on the right. Presentational — actions are handler
// props. Mock / Draft live on the counts row below the header, not here.
export function Header({
  onBrandClick,
  onAbout,
  onLog,
}: {
  onBrandClick: () => void;
  onAbout: () => void;
  onLog: () => void;
}) {
  return (
    <header className="otc-header">
      <button
        type="button"
        className="otc-brand"
        onClick={onBrandClick}
        title="Refresh & replay intro"
        aria-label="Refresh and replay intro"
      >
        <svg className="otc-logo" viewBox="0 0 64 64" width="32" height="32">
          <circle
            cx="32"
            cy="34"
            r="17"
            fill="none"
            stroke="#ff6b4a"
            strokeWidth="4"
          />
          <rect x="26" y="9" width="12" height="5" rx="2.5" fill="#ff6b4a" />
          <line
            x1="32"
            y1="34"
            x2="32"
            y2="23"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line
            x1="32"
            y1="34"
            x2="40"
            y2="38"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="otc-brand-text">
          <h1 className="otc-title">
            <Wordmark />
          </h1>
          <span className="otc-tagline">draft day cheat sheet</span>
        </span>
      </button>
      <span className="otc-header-spacer" />
      <nav className="otc-header-links">
        <button type="button" className="otc-navlink" onClick={onAbout}>
          About
        </button>
        <button type="button" className="otc-navlink" onClick={onLog}>
          Log
        </button>
      </nav>
    </header>
  );
}

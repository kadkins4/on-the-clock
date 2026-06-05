import { Wordmark } from "./Wordmark";

// The app header: brand (logo + wordmark + tagline), a divider, the About/Log
// info links, then the Mock / Draft actions. Presentational — every action is a
// handler passed down from App. Clicking the brand keeps the old refresh +
// replay-intro behavior.
export function Header({
  onBrandClick,
  onAbout,
  onLog,
  onMock,
  onDraft,
}: {
  onBrandClick: () => void;
  onAbout: () => void;
  onLog: () => void;
  onMock: () => void;
  onDraft: () => void;
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
      <span className="otc-header-divider" aria-hidden="true" />
      <nav className="otc-header-links">
        <button type="button" className="otc-navlink" onClick={onAbout}>
          About
        </button>
        <button type="button" className="otc-navlink" onClick={onLog}>
          Log
        </button>
      </nav>
      <span className="otc-header-spacer" />
      <div className="otc-header-actions">
        <button type="button" className="otc-btn" onClick={onMock}>
          Mock
        </button>
        <button
          type="button"
          className="otc-btn otc-btn-primary"
          onClick={onDraft}
        >
          Draft
        </button>
      </div>
    </header>
  );
}

import { Wordmark } from "./Wordmark";
import { AboutContent, LogContent } from "./infoContent";

// Full-page view for the About / Log nav destinations. Plain placeholder pages
// for now (real routing comes later); reuses the shared info copy. A back link
// returns to the board.
export function InfoPage({
  page,
  onBack,
}: {
  page: "about" | "log";
  onBack: () => void;
}) {
  return (
    <main className="otc-page">
      <button
        type="button"
        className="otc-navlink otc-page-back"
        onClick={onBack}
      >
        ← Back to board
      </button>
      {page === "about" && (
        <h1 className="otc-page-title">
          <Wordmark />
        </h1>
      )}
      <div className="otc-page-body">
        {page === "about" ? <AboutContent /> : <LogContent />}
      </div>
    </main>
  );
}

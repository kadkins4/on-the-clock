import { TVStage } from "./TVStage";
import { useAnnouncer } from "./useAnnouncer";

// The #tv cast view. useAnnouncer owns the BroadcastChannel subscription
// (snapshots plus pick events) so this component stays layout-only.
export function TvWindow() {
  const { snapshot, enabled, toggle, speaking } = useAnnouncer();

  return (
    <div className={snapshot ? "tv-window" : "tv-window-waiting"}>
      {snapshot ? (
        <TVStage snapshot={snapshot} />
      ) : (
        <span className="tv-window-waiting-text">
          Waiting for the draft&hellip;
        </span>
      )}

      {/* Off by default. This click is also the TV window's first user gesture,
          which is what unlocks audio here — the main window's unlockAudio()
          can't reach this document, so a stored preference alone can't satisfy
          the autoplay policy. */}
      <button
        type="button"
        className={`tv-announcer-toggle${enabled ? " is-on" : ""}`}
        onClick={toggle}
        aria-pressed={enabled}
      >
        <span className="tv-announcer-dot" aria-hidden="true">
          {speaking ? "●" : enabled ? "○" : "◌"}
        </span>
        {enabled ? "Announcer on" : "Enable announcer"}
      </button>
    </div>
  );
}

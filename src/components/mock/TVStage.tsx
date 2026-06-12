import type { TvSnapshot } from "../../lib/mock/tvSnapshot";
import { POSITION_KEY } from "../../lib/positionColor";
import type { Position } from "../../types";

// ── helpers ───────────────────────────────────────────────────────────────────

const TILE_COUNT = 12;

function LetterTiles({ surname }: { surname: string | null }) {
  const letters = surname ? surname.toUpperCase().split("") : [];
  return (
    <div className="tv-flap-tiles">
      {Array.from({ length: TILE_COUNT }, (_, i) => (
        <div key={i} className="tv-flap-tile">
          {letters[i] ?? ""}
        </div>
      ))}
    </div>
  );
}

function PosBadge({ position }: { position: string | null }) {
  if (!position) return null;
  const style = POSITION_KEY[position as Position];
  if (!style) return null;
  return (
    <span
      className="tv-pos-badge"
      style={{
        background: style.badge,
        color: style.badgeText,
      }}
    >
      {position}
    </span>
  );
}

function TeamAvatar({
  initials,
  color,
  size = 44,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      className="tv-avatar"
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span className="tv-avatar-initials">{initials}</span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  snapshot: TvSnapshot;
}

export function TVStage({ snapshot }: Props) {
  const {
    complete,
    round,
    overall,
    totalPicks,
    onClock,
    currentRound,
    latest,
    upNext,
    ticker,
  } = snapshot;

  return (
    <div className="tv-stage">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="tv-header">
        {/* Left: live label + on-clock team */}
        <div className="tv-header-left">
          <span className="tv-live-dot" />
          <span className="tv-live-label">LIVE · ON THE CLOCK</span>
          {onClock ? (
            <>
              <TeamAvatar
                initials={onClock.initials}
                color={onClock.color}
                size={44}
              />
              <span className="tv-header-team">{onClock.name}</span>
            </>
          ) : (
            <span className="tv-header-team tv-header-complete">
              DRAFT COMPLETE
            </span>
          )}
        </div>

        {/* Center: title */}
        <div className="tv-header-center">
          <span className="tv-board-title">THE BIG BOARD.</span>
        </div>

        {/* Right: round/pick status */}
        <div className="tv-header-right">
          <span className="tv-round-status">
            {complete
              ? "COMPLETE"
              : `R${round} · PICK ${overall} OF ${totalPicks}`}
          </span>
        </div>
      </div>

      {/* ── Body: flap board + right rail ──────────────────────────────── */}
      <div className="tv-body">
        {/* Split-flap board */}
        <div className="tv-flap-board">
          {currentRound.map((row) => (
            <div
              key={row.overall}
              className={`tv-flap-row tv-flap-row--${row.kind}`}
            >
              <span className="tv-flap-pick">{row.label}</span>
              <span className="tv-flap-team">{row.initials}</span>
              {/* key on the surname so the flap animation replays when a pick
                  lands (the row goes from blank → spelled). */}
              <LetterTiles
                key={row.surname ?? row.kind}
                surname={row.surname}
              />
              <PosBadge position={row.position} />
              {row.kind === "current" && (
                <span className="tv-otc-badge">ON THE CLOCK</span>
              )}
            </div>
          ))}
        </div>

        {/* Right rail: latest-pick splash + up next */}
        <div className="tv-rail">
          {/* Latest pick splash */}
          {latest ? (
            // key on the pick label so the spring-in replays per new pick
            <div className="tv-splash" key={latest.label}>
              <span className="tv-splash-label">{latest.label}</span>
              <div className="tv-splash-name">{latest.name}</div>
              <div className="tv-splash-pos">
                <PosBadge position={latest.position} />
                <span className="tv-splash-team">
                  {latest.team}
                  {latest.bye != null ? ` · BYE ${latest.bye}` : ""}
                </span>
              </div>
              <div className="tv-splash-by">
                by <span className="tv-splash-by-team">{latest.byTeam}</span>
              </div>
            </div>
          ) : (
            <div className="tv-splash tv-splash--empty">
              <span className="tv-splash-waiting">Waiting for first pick…</span>
            </div>
          )}

          {/* Up Next */}
          {upNext.length > 0 && (
            <div className="tv-upnext">
              <div className="tv-upnext-label">UP NEXT</div>
              <div className="tv-upnext-list">
                {upNext.map((t, i) => (
                  <div key={`${t.name}-${i}`} className="tv-upnext-item">
                    <TeamAvatar
                      initials={t.initials}
                      color={t.color}
                      size={34}
                    />
                    <span className="tv-upnext-name">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Ticker ─────────────────────────────────────────────────────── */}
      {ticker.length > 0 && (
        <div className="tv-ticker">
          {/* track rendered twice for a seamless 24s marquee loop (B10) */}
          <div className="tv-ticker-track">
            {[0, 1].map((copy) =>
              ticker.map((t, i) => (
                <span
                  key={`${copy}-${i}`}
                  className="tv-ticker-item"
                  aria-hidden={copy === 1 ? true : undefined}
                >
                  <span className="tv-ticker-label">{t.label}</span>
                  <span
                    className="tv-ticker-dot"
                    style={{
                      background:
                        POSITION_KEY[t.position as Position]?.badge ?? "#888",
                    }}
                  />
                  <span className="tv-ticker-name">{t.surname}</span>
                </span>
              )),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

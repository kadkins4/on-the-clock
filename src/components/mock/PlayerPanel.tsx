import { useEffect } from "react";
import type { Player } from "../../types";
import { POSITION_KEY } from "../../lib/positionColor";
import type { PlayerDraftStatus } from "../../lib/mock/playerDraftStatus";

interface Props {
  player: Player | null;
  draftStatus: PlayerDraftStatus;
  onClose: () => void;
}

export function PlayerPanel({ player, draftStatus, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!player) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [player, onClose]);

  if (!player) return null;

  const posStyle = POSITION_KEY[player.position];

  const adpDisplay = player.adp != null ? String(Math.round(player.adp)) : "—";
  const projDisplay =
    player.projPoints != null ? player.projPoints.toFixed(1) : "—";
  // VALUE (VOR) is not available in the mock pool — always "—" per backlog note
  const valueDisplay = "—";

  return (
    <>
      {/* Scrim — click to close */}
      <div className="pc-scrim" onClick={onClose} />

      {/* Card */}
      <div className="pc-card" role="dialog" aria-modal="true">
        {/* Inner frame with 3px position-color border */}
        <div className="pc-frame" style={{ borderColor: posStyle.badge }}>
          {/* Header row: position badge + close button */}
          <div className="pc-header">
            <span
              className="pc-pos-badge"
              style={{
                background: posStyle.badge,
                color: posStyle.badgeText,
              }}
            >
              {player.position}
            </span>
            <button className="pc-close" onClick={onClose}>
              ✕ CLOSE
            </button>
          </div>

          {/* Name plate — meta lives inside; position is dropped here (the
              badge already shows it): team on the left, bye on the right. */}
          <div className="pc-nameplate">
            <span className="pc-name">{player.name}</span>
            <span className="pc-meta">
              <span className="pc-meta-team">{player.team}</span>
              <span className="pc-meta-bye">BYE {player.byeWeek ?? "—"}</span>
            </span>
          </div>

          {/* 3-stat grid */}
          <div className="pc-stats">
            <div className="pc-stat">
              <span className="pc-stat-label">ADP</span>
              <span className="pc-stat-value">{adpDisplay}</span>
            </div>
            <div className="pc-stat">
              <span className="pc-stat-label">PROJ</span>
              <span className="pc-stat-value">{projDisplay}</span>
            </div>
            <div className="pc-stat">
              <span className="pc-stat-label">VOR</span>
              <span className="pc-stat-value pc-stat-value--gold">
                {valueDisplay}
              </span>
            </div>
          </div>

          {/* Status strip */}
          <div
            className="pc-status-strip"
            style={{ background: posStyle.tint }}
          >
            {draftStatus.drafted ? (
              <span
                className="pc-status-text"
                style={{ color: posStyle.subtext }}
              >
                DRAFTED {draftStatus.pickLabel} · {draftStatus.teamName}
              </span>
            ) : (
              <span className="pc-status-text pc-status-text--avail">
                ✓ STILL AVAILABLE
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

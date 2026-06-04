import type { Player } from "../../types";
import { POSITION_COLOR } from "../../lib/positionColor";

interface Props {
  player: Player | null;
  onClose: () => void;
}

export function PlayerPanel({ player, onClose }: Props) {
  return (
    <>
      <div className={`pp-scrim${player ? " open" : ""}`} onClick={onClose} />
      <aside
        className={`player-panel${player ? " open" : ""}`}
        aria-hidden={!player}
      >
        {player && (
          <>
            <div className="ppx-head">
              <button className="ppx-x" onClick={onClose}>
                ✕
              </button>
              <h3 className="ppx-name">{player.name}</h3>
              <span
                className="ppx-pos"
                style={{ background: POSITION_COLOR[player.position] }}
              >
                {player.position}
              </span>
              <span className="ppx-team">· {player.team}</span>
            </div>
            <div className="ppx-body">
              <span className="ppx-soon">Player profile · Coming soon</span>
              <div className="ppx-stub">
                <h4>Season outlook</h4>
                <div className="ppx-bars">
                  <div />
                  <div />
                  <div />
                </div>
              </div>
              <div className="ppx-stub">
                <h4>Recent news</h4>
                <div className="ppx-bars">
                  <div />
                  <div />
                </div>
              </div>
              <div className="ppx-stub">
                <h4>Matchup &amp; schedule</h4>
                <div className="ppx-bars">
                  <div />
                  <div />
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

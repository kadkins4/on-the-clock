import type { MockState } from "../../lib/mock/types";
import { teamRosterPositions } from "../../lib/mock/engine";
import { openNeeds } from "../../lib/mock/roster";
import { formatNeeds } from "../../lib/mock/formatNeeds";
import { formatPick } from "../../lib/mock/board";
import { Avatar } from "./Avatar";

interface Props {
  state: MockState;
}

export function LockerRoom({ state }: Props) {
  const { teams, picks, pool, roster, settings } = state;
  const teamCount = settings.teams;

  // Build a player lookup
  const playerById = new Map(pool.map((p) => [p.id, p]));

  return (
    <div
      className="locker-room"
      style={{ gridTemplateColumns: `repeat(${teamCount}, minmax(0, 1fr))` }}
    >
      {teams.map((team, i) => {
        const teamPicks = picks.filter((pk) => pk.teamIndex === i);
        const drafted = teamRosterPositions(state, i);
        const needs = openNeeds(drafted, roster);
        const needsStr = formatNeeds(needs);

        return (
          <div key={i} className={`lr-col${team.isUser ? " lr-col-user" : ""}`}>
            {/* Header card */}
            <div className={`lr-header${team.isUser ? " lr-header-user" : ""}`}>
              <Avatar initials={team.initials} color={team.color} size={26} />
              <div className="lr-header-text">
                <span className="lr-team-name">{team.name}</span>
                <span className="lr-slot">#{i + 1}</span>
              </div>
            </div>

            {/* Player mini-cards */}
            <div className="lr-picks">
              {teamPicks.length === 0 ? (
                <div className="lr-empty">—</div>
              ) : (
                teamPicks.map((pk) => {
                  const player = playerById.get(pk.playerId);
                  if (!player) return null;
                  return (
                    <div
                      key={pk.overall}
                      className={`lr-pick-card pos-${player.position}`}
                      data-testid="lr-pick-card"
                    >
                      <span className="lr-pick-name" title={player.name}>
                        {player.name}
                      </span>
                      <span className="lr-pick-meta">
                        <span
                          className="lr-pos-badge"
                          data-pos={player.position}
                        >
                          {player.position}
                        </span>
                        <span className="lr-pick-round">R{pk.round}</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Needs footer */}
            <div className="lr-needs" data-testid="lr-needs">
              {needsStr}
            </div>
          </div>
        );
      })}
    </div>
  );
}

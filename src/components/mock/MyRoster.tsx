import type { MockState } from "../../lib/mock/types";
import { teamRosterPositions } from "../../lib/mock/engine";
import { openNeeds } from "../../lib/mock/roster";
import { formatNeeds } from "../../lib/mock/formatNeeds";

interface Props {
  state: MockState;
  userTeamIndex: number;
}

// B6: My Roster panel for the Broadcast Desk. Header shows remaining needs
// (openNeeds, includes FLEX/SUPERFLEX) in gold mono; rows are the user's picks
// as position-tinted entries with their round.
export function MyRoster({ state, userTeamIndex }: Props) {
  const needs = openNeeds(
    teamRosterPositions(state, userTeamIndex),
    state.roster,
  );
  const myPicks = state.picks.filter((pk) => pk.teamIndex === userTeamIndex);

  return (
    <div className="desk-roster">
      <div className="desk-roster-head">
        <span className="desk-panel-title">My Roster</span>
        <span className="desk-roster-needs">{formatNeeds(needs)}</span>
      </div>
      {myPicks.length === 0 ? (
        <div className="desk-roster-empty">Your picks will appear here</div>
      ) : (
        <div className="desk-roster-list">
          {myPicks.map((pk) => {
            const pl = state.pool.find((p) => p.id === pk.playerId);
            if (!pl) return null;
            return (
              <div
                key={pk.overall}
                className={`desk-roster-row pos-${pl.position}`}
              >
                <span className="drr-pos">{pl.position}</span>
                <span className="drr-name">{pl.name}</span>
                <span className="drr-round">R{pk.round}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

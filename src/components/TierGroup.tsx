import type { Dispatch } from "react";
import type { Player } from "../types";
import type { Action } from "../state/reducer";
import { PlayerRow } from "./PlayerRow";

interface Props {
  tier: number | null;
  players: Player[];
  positionalRanks: Record<string, number>;
  dispatch: Dispatch<Action>;
  draggable: boolean;
}

export function TierGroup({
  tier,
  players,
  positionalRanks,
  dispatch,
  draggable,
}: Props) {
  return (
    <>
      <tr className="tier-divider">
        <td colSpan={10}>{tier == null ? "Untiered" : `Tier ${tier}`}</td>
      </tr>
      {players.map((p) => (
        <PlayerRow
          key={p.id}
          player={p}
          positionalRank={positionalRanks[p.id]}
          draggable={draggable}
          dispatch={dispatch}
        />
      ))}
    </>
  );
}

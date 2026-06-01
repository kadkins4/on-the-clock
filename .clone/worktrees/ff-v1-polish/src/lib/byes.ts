import type { Player } from "../types";
import { teamMeta } from "../data/teamMeta";

export function withByeWeeks(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    byeWeek: teamMeta[p.team]?.byeWeek ?? null,
  }));
}

import type { PlayerSourceData, SourcesStore } from "./types";
import { mapFantasyCalc } from "./fantasycalc";
import { mapSleeperProjections } from "./sleeper";

// Combine the raw feed payloads into one ESPN-id-keyed store. FantasyCalc seeds
// the roster (it carries the crosswalk + bio); Sleeper projections attach where
// the crosswalk resolves. Either feed may be empty/undefined (best-effort).
export function buildSources(
  fantasyCalcJson: unknown,
  sleeperJson: unknown,
): { store: SourcesStore; contributed: string[] } {
  const { byEspnId, sleeperToEspn } = mapFantasyCalc(fantasyCalcJson);
  const sleeper = mapSleeperProjections(sleeperJson, sleeperToEspn);

  const store: SourcesStore = {};
  for (const [espnId, row] of byEspnId) {
    const entry: PlayerSourceData = {
      espnId,
      name: row.name,
      position: row.position,
      ids: row.ids,
      fantasycalc: row.fantasycalc,
    };
    const s = sleeper.get(espnId);
    if (s) entry.sleeper = s;
    store[espnId] = entry;
  }

  const contributed: string[] = [];
  if (byEspnId.size > 0) contributed.push("fantasycalc");
  if (sleeper.size > 0) contributed.push("sleeper");
  return { store, contributed };
}

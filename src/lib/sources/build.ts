import type { PlayerSourceData, SourcesStore } from "./types";
import { mapSleeperPlayers, type SleeperPlayerEntry } from "./sleeperPlayers";
import { mapSleeperProjections } from "./sleeper";
import { mapFantasyCalc } from "./fantasycalc";

// Combine the raw feed payloads into one ESPN-id-keyed store. The Sleeper player
// map is the crosswalk hub (espn_id for the whole NFL + bio); Sleeper season
// projections join via it; FantasyCalc adds market value/trend onto its top 200.
//
// A player earns a store entry if it has projections or a FantasyCalc row —
// i.e. it's fantasy-relevant. Bio is enriched from the player map. Any feed may
// be empty/undefined (best-effort).
export function buildSources(
  playerMapJson: unknown,
  projectionsJson: unknown,
  fantasyCalcJson: unknown,
): { store: SourcesStore; contributed: string[] } {
  const { bySleeperId, sleeperToEspn: mapCross } =
    mapSleeperPlayers(playerMapJson);
  const { byEspnId: fc, sleeperToEspn: fcCross } =
    mapFantasyCalc(fantasyCalcJson);

  // Master crosswalk: the player map's espn_ids, overridden by FantasyCalc's
  // (reliable where Sleeper's espn_id is null, e.g. top players like Bijan).
  const cross = new Map(mapCross);
  for (const [sid, eid] of fcCross) cross.set(sid, eid);

  // Projections key by espn id via the merged crosswalk; bio resolves by sleeper
  // id, so a null Sleeper espn_id no longer loses the player.
  const proj = mapSleeperProjections(projectionsJson, cross);
  const bioByEspnId = new Map<string, SleeperPlayerEntry>();
  for (const [sid, eid] of cross) {
    const entry = bySleeperId.get(sid);
    if (entry && !bioByEspnId.has(eid)) bioByEspnId.set(eid, entry);
  }

  const store: SourcesStore = {};
  const espnIds = new Set<string>([...proj.keys(), ...fc.keys()]);
  for (const espnId of espnIds) {
    const b = bioByEspnId.get(espnId);
    const f = fc.get(espnId);
    const entry: PlayerSourceData = {
      espnId,
      name: b?.name || f?.name || "",
      position: b?.position || f?.position || "",
      ids: {
        sleeper: b?.sleeperId ?? f?.ids.sleeper,
        mfl: f?.ids.mfl,
        fleaflicker: f?.ids.fleaflicker,
        ffpc: f?.ids.ffpc,
      },
    };
    if (b) entry.bio = b.bio;
    const p = proj.get(espnId);
    if (p) entry.sleeper = p;
    if (f) entry.fantasycalc = f.fantasycalc;
    store[espnId] = entry;
  }

  const contributed: string[] = [];
  if (bySleeperId.size > 0 || proj.size > 0) contributed.push("sleeper");
  if (fc.size > 0) contributed.push("fantasycalc");
  return { store, contributed };
}

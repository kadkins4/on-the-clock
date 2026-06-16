import type { PlayerSourceData, SourcesStore, PlayerBio } from "./types";
import { mapSleeperPlayers, type SleeperPlayerEntry } from "./sleeperPlayers";
import { mapSleeperProjections } from "./sleeper";
import { mapFantasyCalc } from "./fantasycalc";
import { mapDynastyIds, type DpEntry } from "./dynastyProcess";
import { mapNflverseStats } from "./nflverse";

// Merge bio: the Sleeper player map owns the live fields (injury, depth chart,
// status, jersey, years exp); DynastyProcess backfills the static ones.
function mergeBio(s?: PlayerBio, d?: DpEntry): PlayerBio | undefined {
  if (!s && !d) return undefined;
  return {
    team: s?.team ?? d?.team ?? null,
    age: s?.age ?? d?.age ?? null,
    college: s?.college ?? d?.college ?? null,
    heightInches: s?.heightInches ?? d?.heightInches ?? null,
    weightLbs: s?.weightLbs ?? d?.weightLbs ?? null,
    yearsExp: s?.yearsExp ?? null,
    jersey: s?.jersey ?? null,
    status: s?.status ?? null,
    injuryStatus: s?.injuryStatus ?? null,
    depthChartPos: s?.depthChartPos ?? null,
  };
}

// Combine every feed into one ESPN-id-keyed store. Crosswalk precedence builds
// up sleeper→espn from the Sleeper map, then FantasyCalc, then DynastyProcess
// (the most complete/reliable). DynastyProcess also yields gsis→espn, which is
// how nflverse season stats join the board. A player earns an entry if it has
// projections or a FantasyCalc row (i.e. fantasy-relevant); the other feeds
// enrich it. Every feed is optional (best-effort).
export function buildSources(
  playerMapJson: unknown,
  projectionsJson: unknown,
  fantasyCalcJson: unknown,
  dpCsv: string,
  nflverseCsv: string,
): { store: SourcesStore; contributed: string[] } {
  const { bySleeperId, sleeperToEspn: mapCross } =
    mapSleeperPlayers(playerMapJson);
  const { byEspnId: fc, sleeperToEspn: fcCross } =
    mapFantasyCalc(fantasyCalcJson);
  const {
    byEspnId: dp,
    sleeperToEspn: dpCross,
    gsisToEspn,
  } = mapDynastyIds(dpCsv);

  // Master sleeper→espn crosswalk (later sources override earlier).
  const cross = new Map(mapCross);
  for (const [sid, eid] of fcCross) cross.set(sid, eid);
  for (const [sid, eid] of dpCross) cross.set(sid, eid);

  const proj = mapSleeperProjections(projectionsJson, cross);
  const nfl = mapNflverseStats(nflverseCsv, gsisToEspn);

  // Sleeper-map bio resolved to espn id via the merged crosswalk.
  const sleeperBio = new Map<string, SleeperPlayerEntry>();
  for (const [sid, eid] of cross) {
    const entry = bySleeperId.get(sid);
    if (entry && !sleeperBio.has(eid)) sleeperBio.set(eid, entry);
  }

  const store: SourcesStore = {};
  const espnIds = new Set<string>([...proj.keys(), ...fc.keys()]);
  for (const espnId of espnIds) {
    const sb = sleeperBio.get(espnId);
    const d = dp.get(espnId);
    const f = fc.get(espnId);

    const entry: PlayerSourceData = {
      espnId,
      name: sb?.name || d?.name || f?.name || "",
      position: sb?.position || d?.position || f?.position || "",
      ids: {
        sleeper: sb?.sleeperId ?? d?.ids.sleeper ?? f?.ids.sleeper,
        mfl: d?.ids.mfl ?? f?.ids.mfl,
        fleaflicker: d?.ids.fleaflicker ?? f?.ids.fleaflicker,
        ffpc: f?.ids.ffpc,
        gsis: d?.ids.gsis,
        pfr: d?.ids.pfr,
        fantasypros: d?.ids.fantasypros,
      },
    };
    const bio = mergeBio(sb?.bio, d);
    if (bio) entry.bio = bio;
    if (d) entry.draft = d.draft;
    const p = proj.get(espnId);
    if (p) entry.sleeper = p;
    if (f) entry.fantasycalc = f.fantasycalc;
    const nv = nfl.get(espnId);
    if (nv) entry.nflverse = nv;
    store[espnId] = entry;
  }

  const contributed: string[] = [];
  if (bySleeperId.size > 0 || proj.size > 0) contributed.push("sleeper");
  if (fc.size > 0) contributed.push("fantasycalc");
  if (dp.size > 0) contributed.push("dynastyprocess");
  if (nfl.size > 0) contributed.push("nflverse");
  return { store, contributed };
}

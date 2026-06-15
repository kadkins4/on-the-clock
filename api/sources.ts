import { buildSources } from "../src/lib/sources/build";
import type { SourcesResponse } from "../src/lib/sources/types";

export const config = { runtime: "edge" };

export interface SourcesParams {
  season: number;
  teams: number;
  ppr: number; // 1 = full PPR, 0.5 = half, 0 = standard
}

const FALLBACK_YEARS = 2;

// FantasyCalc — current redraft values + the cross-platform id map. No key.
async function fetchFantasyCalc(
  { teams, ppr }: SourcesParams,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const url = `https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=${teams}&ppr=${ppr}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`FantasyCalc fetch failed: ${res.status}`);
  return res.json();
}

// Sleeper season projections (no key). Falls back a season if the requested
// year has no projections yet (early offseason).
async function fetchSleeper(
  { season }: SourcesParams,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF"]
    .map((p) => `position[]=${p}`)
    .join("&");
  for (let i = 0; i < FALLBACK_YEARS; i++) {
    const year = season - i;
    const url = `https://api.sleeper.com/projections/nfl/${year}?season_type=regular&${positions}`;
    const res = await fetchImpl(url);
    if (!res.ok) continue;
    const data: unknown = await res.json();
    if (Array.isArray(data) && data.length) return data;
  }
  throw new Error(`Sleeper returned no projections near ${season}`);
}

// Sleeper's full player map (~14 MB): the crosswalk hub (espn_id for the whole
// NFL) plus bio/injury fields. Changes ~daily; fetched per refresh for now.
async function fetchSleeperPlayers(fetchImpl: typeof fetch): Promise<unknown> {
  const res = await fetchImpl("https://api.sleeper.com/v1/players/nfl");
  if (!res.ok) throw new Error(`Sleeper players fetch failed: ${res.status}`);
  return res.json();
}

async function settle(p: Promise<unknown>, label: string): Promise<unknown> {
  try {
    return await p;
  } catch (err) {
    console.warn(`[sources] ${label} skipped: ${(err as Error).message}`);
    return null;
  }
}

export async function handleSources(
  params: SourcesParams,
  fetchImpl: typeof fetch = fetch,
): Promise<SourcesResponse> {
  // The Sleeper player map is the crosswalk hub (espn↔sleeper for the whole
  // NFL). Without it, projections can't join the board; FantasyCalc still
  // contributes via its own espnId. All feeds are best-effort.
  const [playerMap, projections, fc] = await Promise.all([
    settle(fetchSleeperPlayers(fetchImpl), "sleeper-players"),
    settle(fetchSleeper(params, fetchImpl), "sleeper-projections"),
    settle(fetchFantasyCalc(params, fetchImpl), "fantasycalc"),
  ]);
  const { store, contributed } = buildSources(playerMap, projections, fc);
  return {
    sources: store,
    meta: {
      count: Object.keys(store).length,
      sources: contributed,
      season: params.season,
    },
  };
}

function pprFromScoring(scoring: string | null): number {
  if (scoring === "standard") return 0;
  if (scoring === "half") return 0.5;
  return 1;
}

export default async function (req: Request): Promise<Response> {
  const url = new URL(req.url);
  const season = Number(
    url.searchParams.get("season") ?? new Date().getFullYear(),
  );
  const teams = Number(url.searchParams.get("teams") ?? 12);
  const ppr = pprFromScoring(url.searchParams.get("scoring"));
  try {
    const body = await handleSources({ season, teams, ppr });
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

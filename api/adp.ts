import {
  ffcFormat,
  mapFfcAdp,
  type FfcRaw,
  type NormalizedAdp,
} from "../src/lib/ffcAdp";
import { parseFantasyPros } from "../src/lib/adpSources/fantasypros";
import { fetchYahooAdp, refreshAccessToken } from "../src/lib/adpSources/yahoo";
import { mapSleeperAdp } from "../src/lib/adpSources/sleeper";
import type { Scoring } from "../src/types";

export const config = { runtime: "edge" };

export interface AdpParams {
  scoring: Scoring;
  teams: number;
  season: number;
}

export interface AdpResponse {
  ffc: NormalizedAdp[];
  fantasypros: NormalizedAdp[];
  yahoo: NormalizedAdp[];
  sleeper: NormalizedAdp[];
  meta: {
    year: number;
    type?: string;
    total_drafts?: number;
    sources: string[];
  };
}

const FALLBACK_YEARS = 3;

interface FfcPayload {
  status: string;
  players?: FfcRaw[];
  meta?: { type?: string; total_drafts?: number };
}

async function fetchFfc(
  { scoring, teams, season }: AdpParams,
  fetchImpl: typeof fetch,
): Promise<{
  players: NormalizedAdp[];
  year: number;
  type?: string;
  total_drafts?: number;
}> {
  const format = ffcFormat(scoring);
  for (let i = 0; i < FALLBACK_YEARS; i++) {
    const year = season - i;
    const url = `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${year}`;
    const res = await fetchImpl(url);
    if (!res.ok) continue;
    const data = (await res.json()) as FfcPayload;
    if (data.status === "Success" && data.players?.length) {
      return {
        players: mapFfcAdp(data.players),
        year,
        type: data.meta?.type,
        total_drafts: data.meta?.total_drafts,
      };
    }
  }
  throw new Error(
    `FFC returned no ADP for ${format} within ${FALLBACK_YEARS} seasons of ${season}`,
  );
}

async function fetchFantasyPros(
  scoring: Scoring,
  fetchImpl: typeof fetch,
): Promise<NormalizedAdp[]> {
  const slug =
    scoring === "standard" ? "overall" : `${ffcFormat(scoring)}-overall`;
  const res = await fetchImpl(
    `https://www.fantasypros.com/nfl/adp/${slug}.php`,
    {
      headers: { "user-agent": "Mozilla/5.0" },
    },
  );
  if (!res.ok) throw new Error(`FantasyPros fetch failed: ${res.status}`);
  return parseFantasyPros(await res.text());
}

async function fetchYahoo(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<NormalizedAdp[]> {
  const { YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, YAHOO_REFRESH_TOKEN } = env;
  if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET || !YAHOO_REFRESH_TOKEN)
    return [];
  const token = await refreshAccessToken(
    YAHOO_REFRESH_TOKEN,
    YAHOO_CLIENT_ID,
    YAHOO_CLIENT_SECRET,
    fetchImpl,
  );
  // Page the whole draft-analysis list (Yahoo serves 25/request). The paginator
  // stops at the first page with no ADP rows — i.e. past the drafted universe —
  // so the cap is just a safety bound, not the real limit.
  return fetchYahooAdp(token, fetchImpl, 600);
}

// Sleeper's season projections carry per-format real-draft ADP (huge sample).
// No key; falls back a season if the requested year has no projections yet.
async function fetchSleeperAdp(
  { scoring, season }: AdpParams,
  fetchImpl: typeof fetch,
): Promise<NormalizedAdp[]> {
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF"]
    .map((p) => `position[]=${p}`)
    .join("&");
  for (let i = 0; i < FALLBACK_YEARS; i++) {
    const year = season - i;
    const url = `https://api.sleeper.com/projections/nfl/${year}?season_type=regular&${positions}`;
    const res = await fetchImpl(url);
    if (!res.ok) continue;
    const data: unknown = await res.json();
    if (Array.isArray(data) && data.length) return mapSleeperAdp(data, scoring);
  }
  throw new Error(`Sleeper returned no ADP near ${season}`);
}

// Each non-primary source is best-effort: a failure logs and contributes [].
async function settle<T>(p: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await p;
  } catch (err) {
    console.warn(`[adp] ${label} skipped: ${(err as Error).message}`);
    return [];
  }
}

export async function handleAdp(
  params: AdpParams,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {},
): Promise<AdpResponse> {
  const ffc = await fetchFfc(params, fetchImpl); // primary — may throw
  const [fantasypros, yahoo, sleeper] = await Promise.all([
    settle(fetchFantasyPros(params.scoring, fetchImpl), "fantasypros"),
    settle(fetchYahoo(env, fetchImpl), "yahoo"),
    settle(fetchSleeperAdp(params, fetchImpl), "sleeper"),
  ]);
  const sources = ["ffc"];
  if (fantasypros.length) sources.push("fantasypros");
  if (yahoo.length) sources.push("yahoo");
  if (sleeper.length) sources.push("sleeper");
  return {
    ffc: ffc.players,
    fantasypros,
    yahoo,
    sleeper,
    meta: {
      year: ffc.year,
      type: ffc.type,
      total_drafts: ffc.total_drafts,
      sources,
    },
  };
}

export default async function (req: Request): Promise<Response> {
  const url = new URL(req.url);
  const scoring = (url.searchParams.get("scoring") ?? "ppr") as Scoring;
  const teams = Number(url.searchParams.get("teams") ?? "12");
  const season = Number(
    url.searchParams.get("season") ?? new Date().getFullYear(),
  );
  try {
    const body = await handleAdp({ scoring, teams, season });
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}

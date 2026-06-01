import {
  ffcFormat,
  mapFfcAdp,
  type FfcRaw,
  type NormalizedAdp,
} from "../src/lib/ffcAdp";
import type { Scoring } from "../src/types";

export interface AdpParams {
  scoring: Scoring;
  teams: number;
  season: number;
}

export interface AdpResponse {
  players: NormalizedAdp[];
  meta: { year: number; type?: string; total_drafts?: number };
}

const FALLBACK_YEARS = 3; // try season, season-1, season-2

interface FfcPayload {
  status: string;
  players?: FfcRaw[];
  meta?: { type?: string; total_drafts?: number };
}

// FFC has no CORS header, so this runs server-side only.
export async function handleAdp(
  { scoring, teams, season }: AdpParams,
  fetchImpl: typeof fetch = fetch,
): Promise<AdpResponse> {
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
        meta: {
          year,
          type: data.meta?.type,
          total_drafts: data.meta?.total_drafts,
        },
      };
    }
  }
  throw new Error(
    `FFC returned no ADP for ${format} within ${FALLBACK_YEARS} seasons of ${season}`,
  );
}

// Vercel-compatible default export (used when the app is hosted; the Vite dev
// middleware calls handleAdp directly).
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

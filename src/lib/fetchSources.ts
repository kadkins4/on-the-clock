import type { Scoring } from "../types";
import type { SourcesResponse } from "./sources/types";

// Pull the normalized third-party source store (Sleeper + FantasyCalc) from the
// serverless endpoint. Keyed by ESPN id so it joins straight onto the board.
export async function fetchSources(
  scoring: Scoring,
  teams: number,
): Promise<SourcesResponse> {
  const res = await fetch(`/api/sources?scoring=${scoring}&teams=${teams}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`Sources fetch failed: ${body.error ?? res.status}`);
  }
  return (await res.json()) as SourcesResponse;
}

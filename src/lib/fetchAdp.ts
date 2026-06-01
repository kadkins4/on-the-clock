import type { Scoring } from "../types";
import type { NormalizedAdp } from "./ffcAdp";
import type { AdpResponse } from "../../api/adp";

export async function fetchAdp(
  scoring: Scoring,
  teams: number,
): Promise<AdpResponse> {
  const res = await fetch(`/api/adp?scoring=${scoring}&teams=${teams}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`ADP fetch failed: ${body.error ?? res.status}`);
  }
  return (await res.json()) as AdpResponse;
}

export type { NormalizedAdp };

import type { Player } from "../types";
import { adpMatchKey, type NormalizedAdp } from "./ffcAdp";

export interface AdpSources {
  espn?: number | null;
  ffc?: number | null;
}

// Mean of available sources. Single source passes through unrounded so an
// ESPN-only value stays identical to pre-blend behavior. (Scoring-weighting is
// a deliberate v1.5 follow-up.)
export function blendAdp(sources: AdpSources): number | null {
  const vals = [sources.espn, sources.ffc].filter(
    (v): v is number => v != null,
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Non-destructive: match FFC ADP onto existing board players (by name+position,
// DST by team), record it in adpSources.ffc, and recompute adp. Order, tiers,
// flags, notes and draft status are untouched.
export function applyFfcAdp(board: Player[], ffc: NormalizedAdp[]): Player[] {
  const byKey = new Map<string, NormalizedAdp>();
  for (const f of ffc) {
    const key = adpMatchKey(f.position, f.name, f.team);
    if (!byKey.has(key)) byKey.set(key, f); // first match wins on rare collisions
  }
  return board.map((p) => {
    const match = byKey.get(adpMatchKey(p.position, p.name, p.team));
    const sources: AdpSources = {
      ...p.adpSources,
      ffc: match ? match.adp : (p.adpSources?.ffc ?? undefined),
    };
    if (sources.ffc == null) delete sources.ffc;
    return { ...p, adpSources: sources, adp: blendAdp(sources) };
  });
}

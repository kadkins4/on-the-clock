import type { Player, Position } from "../types";
import { adpMatchKey, type NormalizedAdp } from "./ffcAdp";

export interface AdpSources {
  espn?: number | null;
  ffc?: number | null;
  fantasypros?: number | null;
  yahoo?: number | null;
}

// Weighted blend. Consensus aggregates (FantasyPros, FFC) outrank single
// platforms; ESPN is weighted lowest because it skews K/DST early.
const WEIGHTS: Record<keyof AdpSources, number> = {
  fantasypros: 3,
  ffc: 2,
  yahoo: 2,
  espn: 1,
};

// K/DST priced by ESPN alone can't sort earlier than this (round ~9). Narrow
// safety net for early-season before consensus sources price kickers.
export const KDST_ADP_FLOOR = 100;

export function blendAdp(
  sources: AdpSources,
  position: Position,
): number | null {
  let weight = 0;
  let weighted = 0;
  let consensusPresent = false; // any non-ESPN source
  for (const key of [
    "fantasypros",
    "ffc",
    "yahoo",
    "espn",
  ] as (keyof AdpSources)[]) {
    const v = sources[key];
    if (v == null) continue;
    weighted += v * WEIGHTS[key];
    weight += WEIGHTS[key];
    if (key !== "espn") consensusPresent = true;
  }
  if (weight === 0) return null;
  const adp = weighted / weight;
  if ((position === "K" || position === "DST") && !consensusPresent) {
    return Math.max(adp, KDST_ADP_FLOOR);
  }
  return adp;
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
    // Seed players carry `adp` but no adpSources yet — treat that existing
    // number as the ESPN baseline so a first apply blends rather than discards.
    const espn = p.adpSources?.espn ?? p.adp;
    const sources: AdpSources = {
      espn,
      ffc: match ? match.adp : (p.adpSources?.ffc ?? undefined),
    };
    if (sources.espn == null) delete sources.espn;
    if (sources.ffc == null) delete sources.ffc;
    return { ...p, adpSources: sources, adp: blendAdp(sources) };
  });
}

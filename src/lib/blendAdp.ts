import type { Player, Position } from "../types";
import { adpMatchKey, type NormalizedAdp } from "./ffcAdp";

export interface AdpSources {
  espn?: number | null;
  ffc?: number | null;
  fantasypros?: number | null;
  yahoo?: number | null;
  sleeper?: number | null;
}

// Weighted blend. Consensus aggregates (FantasyPros, FFC) outrank single
// platforms; Sleeper carries a huge real-draft sample (weighted like FFC/Yahoo);
// ESPN is weighted lowest because it skews K/DST early.
const WEIGHTS: Record<keyof AdpSources, number> = {
  fantasypros: 3,
  ffc: 2,
  yahoo: 2,
  sleeper: 2,
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
    "sleeper",
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

export interface AdpInputs {
  ffc?: NormalizedAdp[];
  fantasypros?: NormalizedAdp[];
  yahoo?: NormalizedAdp[];
  sleeper?: NormalizedAdp[];
}

function indexByKey(list?: NormalizedAdp[]): Map<string, NormalizedAdp> {
  const m = new Map<string, NormalizedAdp>();
  for (const a of list ?? []) {
    const key = adpMatchKey(a.position, a.name, a.team);
    if (!m.has(key)) m.set(key, a); // first match wins on rare collisions
  }
  return m;
}

// Non-destructive: match each source's ADP onto board players (by name+position,
// DST by team), record per-source values in adpSources, and recompute the
// weighted adp. Order, tiers, flags, notes and draft status are untouched.
export function applyAdp(board: Player[], inputs: AdpInputs): Player[] {
  const ffcM = indexByKey(inputs.ffc);
  const fpM = indexByKey(inputs.fantasypros);
  const yM = indexByKey(inputs.yahoo);
  const slM = indexByKey(inputs.sleeper);
  return board.map((p) => {
    const key = adpMatchKey(p.position, p.name, p.team);
    // Seed players carry `adp` but no adpSources yet — treat the existing number
    // as the ESPN baseline so a first apply blends rather than discards it.
    const espn = p.adpSources?.espn ?? p.adp;
    const ffc = ffcM.get(key)?.adp ?? p.adpSources?.ffc;
    const fantasypros = fpM.get(key)?.adp ?? p.adpSources?.fantasypros;
    const yahoo = yM.get(key)?.adp ?? p.adpSources?.yahoo;
    const sleeper = slM.get(key)?.adp ?? p.adpSources?.sleeper;
    const sources: AdpSources = {};
    if (espn != null) sources.espn = espn;
    if (ffc != null) sources.ffc = ffc;
    if (fantasypros != null) sources.fantasypros = fantasypros;
    if (yahoo != null) sources.yahoo = yahoo;
    if (sleeper != null) sources.sleeper = sleeper;
    return { ...p, adpSources: sources, adp: blendAdp(sources, p.position) };
  });
}

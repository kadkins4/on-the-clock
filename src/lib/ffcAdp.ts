import type { Position, Scoring } from "../types";

export interface FfcRaw {
  name: string;
  position: string; // QB RB WR TE PK DEF
  team: string;
  adp: number;
}

export interface NormalizedAdp {
  name: string;
  position: Position;
  team: string;
  adp: number;
}

export function ffcFormat(scoring: Scoring): string {
  return scoring === "half" ? "half-ppr" : scoring; // ppr | half-ppr | standard
}

const FFC_POS: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  PK: "K",
  DEF: "DST",
};

export function mapFfcAdp(raw: FfcRaw[]): NormalizedAdp[] {
  const out: NormalizedAdp[] = [];
  for (const r of raw) {
    const position = FFC_POS[r.position];
    if (!position) continue;
    out.push({ name: r.name, position, team: r.team, adp: r.adp });
  }
  return out;
}

// Lowercase, drop generational suffixes, strip . ' ` - so name spellings line
// up across sources (e.g. "A.J. Brown" vs "AJ Brown").
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/g, "")
    .replace(/[.'`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Defenses name inconsistently across sources but share a team abbreviation, so
// match DST by team; everyone else by position + normalized name.
export function adpMatchKey(
  position: Position,
  name: string,
  team: string,
): string {
  return position === "DST"
    ? `dst:${team}`
    : `${position}:${normalizeName(name)}`;
}

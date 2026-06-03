import type { Position, RosterSettings } from "../types";
import { POSITIONS } from "../types";

export const FLEX_SET: ReadonlySet<Position> = new Set<Position>([
  "RB",
  "WR",
  "TE",
]);
export const SFLEX_SET: ReadonlySet<Position> = new Set<Position>([
  "QB",
  "RB",
  "WR",
  "TE",
]);

export type Macro = "FLEX" | "SFLEX" | "ALL";

export function setsEqual(
  a: ReadonlySet<Position>,
  b: ReadonlySet<Position>,
): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** Empty active set = ALL (no filter). */
export function matchesPosFilter(
  active: ReadonlySet<Position>,
  pos: Position,
): boolean {
  return active.size === 0 || active.has(pos);
}

/** Toggle a single position chip; returns a new set (never mutates input). */
export function toggleChip(
  active: ReadonlySet<Position>,
  pos: Position,
): Set<Position> {
  const next = new Set(active);
  if (next.has(pos)) next.delete(pos);
  else next.add(pos);
  return next;
}

/** Apply a macro chip. Clicking an active macro again clears; ALL always clears. */
export function applyMacro(
  active: ReadonlySet<Position>,
  macro: Macro,
): Set<Position> {
  if (macro === "ALL") return new Set();
  const target = macro === "FLEX" ? FLEX_SET : SFLEX_SET;
  if (setsEqual(active, target)) return new Set();
  return new Set(target);
}

/** Positions the league actually rosters, in canonical POSITIONS order. */
export function rosteredPositions(roster: RosterSettings): Position[] {
  return POSITIONS.filter((p) => roster[p] > 0 && !roster.disabled.includes(p));
}

export interface ChipConfig {
  positions: Position[];
  flex: boolean;
  sflex: boolean;
}

/** Which chips to render for a league's roster (spec §4 "chip presence"). */
export function chipConfig(roster: RosterSettings): ChipConfig {
  const positions = rosteredPositions(roster);
  const flex = positions.some((p) => FLEX_SET.has(p));
  return { positions, flex, sflex: roster.SUPERFLEX > 0 };
}

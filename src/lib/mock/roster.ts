import type { Position, RosterSettings } from "../../types";

const FLEX_POOL: Position[] = ["RB", "WR", "TE"];
const SUPER_POOL: Position[] = ["QB", "RB", "WR", "TE"];
const BASE: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export interface Needs {
  base: Partial<Record<Position, number>>; // open base starter slots
  flex: number; // open FLEX slots
  superflex: number; // open SUPERFLEX slots
}

// Greedily place a team's drafted players into base slots, then spill the
// extras into FLEX, then SUPERFLEX, and report what's still open.
export function openNeeds(drafted: Position[], r: RosterSettings): Needs {
  const have: Record<string, number> = {};
  for (const p of drafted) have[p] = (have[p] ?? 0) + 1;

  const base: Partial<Record<Position, number>> = {};
  const leftover: Record<string, number> = {};
  for (const pos of BASE) {
    const need = r.disabled.includes(pos) ? 0 : r[pos];
    const has = have[pos] ?? 0;
    const used = Math.min(has, need);
    if (need - used > 0) base[pos] = need - used;
    leftover[pos] = has - used;
  }

  let flex = r.FLEX;
  for (const pos of FLEX_POOL) {
    const take = Math.min(flex, leftover[pos] ?? 0);
    flex -= take;
    leftover[pos] = (leftover[pos] ?? 0) - take;
  }

  let superflex = r.SUPERFLEX;
  for (const pos of SUPER_POOL) {
    const take = Math.min(superflex, leftover[pos] ?? 0);
    superflex -= take;
    leftover[pos] = (leftover[pos] ?? 0) - take;
  }

  return { base, flex, superflex };
}

export function servesNeed(pos: Position, needs: Needs): boolean {
  if (needs.base[pos]) return true;
  if (needs.flex > 0 && FLEX_POOL.includes(pos)) return true;
  if (needs.superflex > 0 && SUPER_POOL.includes(pos)) return true;
  return false;
}

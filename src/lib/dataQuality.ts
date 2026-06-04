import type { Player } from "../types";

export interface QualityIssue {
  id: string;
  name: string;
  problems: string[]; // e.g. ["no ADP", "no Proj"]
}

const SKILL = new Set(["QB", "RB", "WR", "TE"]); // positions that should have stat lines

// Compute per-player data gaps from the current board. K/DST (and the lack of a
// prior line for rookies) are expected blanks and are not flagged for stats.
export function dataQualityIssues(players: Player[]): QualityIssue[] {
  const out: QualityIssue[] = [];
  for (const p of players) {
    const problems: string[] = [];
    if (p.adp == null) problems.push("no ADP");
    if (p.byeWeek == null) problems.push("no bye");
    if (SKILL.has(p.position)) {
      if (!p.projStats) problems.push("no Proj");
      if (!p.lastStats) problems.push("no '25");
    }
    if (problems.length) out.push({ id: p.id, name: p.name, problems });
  }
  return out;
}

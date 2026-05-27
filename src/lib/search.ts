import type { Player } from "../types";
import { teamMeta } from "../data/teamMeta";

function fieldScore(field: string, q: string): number {
  const f = field.toLowerCase();
  if (f === q) return 100;
  if (f.startsWith(q)) return 50;
  if (f.includes(q)) return 25;
  return 0;
}

export function searchPlayers(players: Player[], query: string): Player[] {
  const q = query.trim().toLowerCase();
  if (q === "") return players;

  const scored = players
    .map((p) => {
      const meta = teamMeta[p.team];
      const nameScore = fieldScore(p.name, q);
      const teamScore = Math.max(
        fieldScore(p.team, q),
        meta ? fieldScore(meta.city, q) : 0,
        meta ? fieldScore(meta.nickname, q) : 0,
      );
      const base = Math.max(nameScore, teamScore);
      if (base === 0) return null;
      // a D/ST whose team matched ranks above that team's individual players
      const dstBonus = teamScore >= nameScore && p.position === "DST" ? 10 : 0;
      return { p, score: base + dstBonus };
    })
    .filter((x): x is { p: Player; score: number } => x !== null);

  scored.sort((a, b) => b.score - a.score || a.p.overallRank - b.p.overallRank);
  return scored.map((x) => x.p);
}

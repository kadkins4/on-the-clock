import type { Player, Position, Flag, DraftStatus } from "../types";
import { POSITIONS } from "../types";
import { uid } from "./uid";

const HEADER = [
  "rank",
  "name",
  "position",
  "team",
  "bye",
  "tier",
  "adp",
  "notes",
  "flag",
  "draft",
];

function escapeField(v: string): string {
  const s = v.replace(/\r?\n/g, " "); // collapse newlines so a field never spans CSV lines
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(players: Player[]): string {
  const rows = [HEADER.join(",")];
  for (const p of players) {
    rows.push(
      [
        String(p.overallRank),
        escapeField(p.name),
        p.position,
        escapeField(p.team),
        p.byeWeek == null ? "" : String(p.byeWeek),
        p.tier == null ? "" : String(p.tier),
        p.adp == null ? "" : String(p.adp),
        escapeField(p.notes),
        p.flag,
        p.draftStatus,
      ].join(","),
    );
  }
  return rows.join("\n");
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toPosition(v: string): Position {
  const up = v.toUpperCase();
  return (POSITIONS as string[]).includes(up) ? (up as Position) : "WR";
}

function toFlag(v: string): Flag {
  return v === "target" || v === "avoid" ? v : "none";
}

function toDraftStatus(v: string): DraftStatus {
  return v === "mine" || v === "taken" ? v : "available";
}

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseCsv(text: string): Player[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const ci = {
    rank: col("rank"),
    name: col("name"),
    position: col("position"),
    team: col("team"),
    bye: col("bye"),
    tier: col("tier"),
    adp: col("adp"),
    notes: col("notes"),
    flag: col("flag"),
    draft: col("draft"),
  };
  const players: Player[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const get = (idx: number) => (idx >= 0 && idx < f.length ? f[idx] : "");
    const rankVal = numOrNull(get(ci.rank));
    players.push({
      id: uid(),
      name: get(ci.name).trim(),
      position: toPosition(get(ci.position)),
      team: get(ci.team).trim() || "FA",
      overallRank: rankVal ?? i,
      byeWeek: numOrNull(get(ci.bye)),
      tier: numOrNull(get(ci.tier)),
      adp: numOrNull(get(ci.adp)),
      notes: get(ci.notes),
      flag: toFlag(get(ci.flag).trim()),
      draftStatus: toDraftStatus(get(ci.draft).trim()),
    });
  }
  return players;
}

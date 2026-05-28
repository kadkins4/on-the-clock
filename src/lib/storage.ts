import type { Player } from "../types";
import seed from "../data/seed.json";
import { withByeWeeks } from "./byes";
import { normalizeTiers, orderByAdp } from "./ranking";

const KEY = "ff-cheat-sheet:players:v2";

export function savePlayers(players: Player[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(players));
  } catch {
    // storage full / unavailable — ignore
  }
}

export function loadPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed))
        return normalizeTiers(withByeWeeks(parsed as Player[]));
    }
  } catch {
    // corrupt JSON — fall through to seed
  }
  // fresh board: default to ADP order with ADP-based tiers
  return normalizeTiers(withByeWeeks(orderByAdp(seed as unknown as Player[])));
}

export function exportJson(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}

export function importJson(text: string): Player[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed))
    throw new Error("Expected a JSON array of players");
  return parsed as Player[];
}

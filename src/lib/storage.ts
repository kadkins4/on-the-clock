import type { Player } from "../types";
import type { Board } from "../state/reducer";
import seed from "../data/seed.json";
import { withByeWeeks } from "./byes";
import { normalizeTiers, orderByAdp } from "./ranking";

const LISTS_KEY = "ff-cheat-sheet:lists:v1";
const OLD_KEY = "ff-cheat-sheet:players:v2"; // pre-named-lists single board

export function saveBoard(board: Board): void {
  try {
    localStorage.setItem(LISTS_KEY, JSON.stringify(board));
  } catch {
    // storage full / unavailable — ignore
  }
}

function readBoard(): Board {
  try {
    const raw = localStorage.getItem(LISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.current === "string" &&
        parsed.lists &&
        Array.isArray(parsed.lists[parsed.current])
      ) {
        return parsed as Board;
      }
    }
  } catch {
    // corrupt JSON — fall through
  }
  // migrate a pre-named-lists single board
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const arr = JSON.parse(old);
      if (Array.isArray(arr)) {
        return { current: "My Board", lists: { "My Board": arr as Player[] } };
      }
    }
  } catch {
    // ignore
  }
  // brand-new board: a single ADP-ordered list
  return {
    current: "My Board",
    lists: { "My Board": orderByAdp(seed as unknown as Player[]) },
  };
}

export function loadBoard(): Board {
  const board = readBoard();
  // normalize the active list (tiers + bye weeks) for immediate use
  return {
    ...board,
    lists: {
      ...board.lists,
      [board.current]: normalizeTiers(withByeWeeks(board.lists[board.current])),
    },
  };
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

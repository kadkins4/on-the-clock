import type { League, LeaguesState, Player } from "../types";
import type { Board } from "../state/reducer";
import seed from "../data/seed.json";
import { withByeWeeks } from "./byes";
import { normalizeTiers, orderByAdp } from "./ranking";
import { breaksFromTiers, tiersFromBreaks } from "./tierBreaks";
import { migrateBoardToLeagues, activeTierList } from "./league";
import {
  sanitizeLayout,
  DEFAULT_LAYOUT,
  type ColumnLayout,
} from "./columnLayout";
import { safeStorage } from "./safeStorage";
import { uid } from "./uid";

const LISTS_KEY = "ff-cheat-sheet:lists:v1";
const OLD_KEY = "ff-cheat-sheet:players:v2"; // pre-named-lists single board

function readBoard(): Board {
  try {
    const raw = safeStorage.getItem(LISTS_KEY);
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
    const old = safeStorage.getItem(OLD_KEY);
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

export function exportJson(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}

export function importJson(text: string): Player[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed))
    throw new Error("Expected a JSON array of players");
  return parsed as Player[];
}

// --- Leagues ----------------------------------------------------------------

const LEAGUES_KEY_V1 = "ff-cheat-sheet:leagues:v1"; // legacy single-board leagues
const LEAGUES_KEY_V2 = "ff-cheat-sheet:leagues:v2"; // leagues with tier lists

export function saveLeagues(state: LeaguesState): void {
  safeStorage.setItem(LEAGUES_KEY_V2, JSON.stringify(state));
}

// A v1 league carried a single `board`; v2 wraps it as one "Default" tier list.
// Leagues already in v2 shape pass through untouched (idempotent).
export function migrateLeaguesV1toV2(state: LeaguesState): LeaguesState {
  return {
    ...state,
    leagues: state.leagues.map((l) => {
      if (Array.isArray((l as { tierLists?: unknown }).tierLists)) return l;
      const { board = [], ...rest } = l as League & { board?: Player[] };
      const id = uid();
      return {
        ...rest,
        tierLists: [{ id, name: "Default", board }],
        activeTierListId: id,
        defaultTierListId: id,
      } as League;
    }),
  };
}

function parseLeagues(key: string): LeaguesState | null {
  try {
    const raw = safeStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // An empty `leagues` array is invalid state, not "no data": reject it here
      // so it never reaches loadLeagues, where `leagues[0].id` would crash the
      // app on load. The caller's seed-migration fallback then takes over.
      if (
        parsed &&
        typeof parsed.currentId === "string" &&
        Array.isArray(parsed.leagues) &&
        parsed.leagues.length > 0
      ) {
        return parsed as LeaguesState;
      }
    }
  } catch {
    // corrupt JSON — fall through
  }
  return null;
}

function readLeagues(): LeaguesState | null {
  const v2 = parseLeagues(LEAGUES_KEY_V2);
  if (v2) return v2;
  // older single-board leagues → wrap each board as a "Default" tier list
  const v1 = parseLeagues(LEAGUES_KEY_V1);
  if (v1) return migrateLeaguesV1toV2(v1);
  return null;
}

export function loadLeagues(): LeaguesState {
  const existing = readLeagues();
  // when absent, migrate forward from the named-lists Board (which itself
  // migrates the older single board, or falls back to the fresh seed).
  const state = existing ?? migrateBoardToLeagues(readBoard());
  const currentId =
    state.leagues.find((l) => l.id === state.currentId)?.id ??
    state.leagues[0].id;
  // normalize the current league's active list (tiers + bye weeks) for use
  return {
    currentId,
    leagues: state.leagues.map((l) =>
      l.id === currentId ? normalizeActiveList(l) : l,
    ),
  };
}

function normalizeActiveList(l: League): League {
  const active = activeTierList(l);
  const normalized = normalizeTiers(withByeWeeks(active.board));
  // Derive break boundaries from tier when absent so the board renders its
  // tiers on first paint (before any edit re-derives them in the reducer).
  const breaks = active.breaks ?? breaksFromTiers(normalized);
  const board = tiersFromBreaks(normalized, breaks);
  return {
    ...l,
    tierLists: l.tierLists.map((t) =>
      t.id === active.id ? { ...t, board, breaks } : t,
    ),
  };
}

// --- Column layout (Phase 4) ---
const COLUMNS_KEY = "otc:columns";
const COL_SCOPE_KEY = "otc:columnScopePref";
export type ColumnScopePref = "ask" | "all" | "this";

export function loadColumnLayout(): ColumnLayout {
  try {
    const raw = safeStorage.getItem(COLUMNS_KEY);
    return raw ? sanitizeLayout(JSON.parse(raw)) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveColumnLayout(layout: ColumnLayout): void {
  safeStorage.setItem(COLUMNS_KEY, JSON.stringify(layout));
}

export function loadColumnScopePref(): ColumnScopePref {
  const v = safeStorage.getItem(COL_SCOPE_KEY);
  return v === "all" || v === "this" ? v : "ask";
}

export function saveColumnScopePref(p: ColumnScopePref): void {
  safeStorage.setItem(COL_SCOPE_KEY, p);
}

// --- Sort mode (A6) ---
const SORT_MODE_KEY = "otc:sortMode";
export type SortMode = "tier" | "adp";

export function loadSortMode(): SortMode {
  const v = safeStorage.getItem(SORT_MODE_KEY);
  return v === "adp" ? "adp" : "tier";
}

export function saveSortMode(mode: SortMode): void {
  safeStorage.setItem(SORT_MODE_KEY, mode);
}

// --- Dev diagnostics (Phase 5) ---
const REFETCH_KEY = "otc:devRefetch";
const ERRORS_KEY = "otc:devErrors";
const MAX_ERRORS = 50;

export interface RefetchResult {
  ok: boolean;
  at: number; // epoch ms
  count?: number; // mapped/merged players on success
  reason?: string; // failure reason
  fingerprint?: string; // failure fingerprint
}
export interface LoggedError {
  at: number;
  message: string;
  source: "onerror" | "unhandledrejection" | "boundary";
  stack?: string;
}

export function loadRefetchResult(): RefetchResult | null {
  try {
    const raw = safeStorage.getItem(REFETCH_KEY);
    return raw ? (JSON.parse(raw) as RefetchResult) : null;
  } catch {
    return null;
  }
}
export function saveRefetchResult(r: RefetchResult): void {
  safeStorage.setItem(REFETCH_KEY, JSON.stringify(r));
}
export function loadErrorLog(): LoggedError[] {
  try {
    const raw = safeStorage.getItem(ERRORS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as LoggedError[]) : [];
  } catch {
    return [];
  }
}
export function pushErrorLog(e: LoggedError): void {
  const next = [e, ...loadErrorLog()].slice(0, MAX_ERRORS);
  safeStorage.setItem(ERRORS_KEY, JSON.stringify(next));
}
export function clearErrorLog(): void {
  safeStorage.removeItem(ERRORS_KEY);
}

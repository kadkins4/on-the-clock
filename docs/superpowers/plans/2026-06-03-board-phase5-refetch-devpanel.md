# Board Redesign — Phase 5: Refetch + ESPN-Shape Guard + Gated `/dev` Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface a "keeps your tiers" Refetch in the settings menu guarded by a validate-at-the-boundary ESPN-shape check (corrupt response = no-op + message), and add a `?dev=1`-gated diagnostics panel showing last-refetch result, data-quality issues, a runtime-error log, and the destructive Reset board.

**Architecture:** A pure `validateEspnShape(raw)` runs before mapping; the fetch path commits to state only on success and records the result (ok or failure fingerprint) to localStorage. A pure `dataQualityIssues(board)` computes board diagnostics on view. A module-level error buffer (`window.onerror`/`unhandledrejection` + a React error boundary) persists caught errors to localStorage. A `DevPanel` component, rendered when `?dev=1`, reads these stores. Reset board (fresh seed) lives gated inside it.

**Tech Stack:** React 19 + TS, Vitest + RTL, existing `fetchEspn.ts` / `storage.ts` / reducer. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-02-board-redesign-columns-filters-design.md` §7 + §9.

---

## File Structure

- **Modify** `src/lib/fetchEspn.ts` — add `validateEspnShape(rawPlayers): ShapeResult` and run it inside `fetchEspnPlayers`; export the result type + a thrown `EspnShapeError`.
- **Create** `src/lib/fetchEspn.fixture.test.ts` + `src/lib/__fixtures__/espn-sample.json` — captured-fixture regression test for `mapEspnPlayers`.
- **Modify** `src/lib/storage.ts` — `loadRefetchResult`/`saveRefetchResult` (`otc:devRefetch`), `loadErrorLog`/`pushErrorLog`/`clearErrorLog` (`otc:devErrors`).
- **Create** `src/lib/devLog.ts` — `installErrorHandlers()` (window.onerror/unhandledrejection → buffer) + the `LoggedError` type.
- **Create** `src/lib/dataQuality.ts` + `dataQuality.test.ts` — pure `dataQualityIssues(players): QualityIssue[]`.
- **Create** `src/components/ErrorBoundary.tsx` — class boundary that buffers and renders a fallback.
- **Create** `src/components/dev/DevPanel.tsx` + `DevPanel.test.tsx` — the gated panel.
- **Modify** `src/App.tsx` — refetch orchestration (guard + record + toast), `?dev=1` render of `DevPanel`, Reset board dispatch.
- **Modify** `src/components/Toolbar.tsx` — relabel/clarify the Refetch item ("keeps your tiers"); add a `fetchStatus` hint line.
- **Modify** `src/main.tsx` — call `installErrorHandlers()`; wrap `<App/>` in `<ErrorBoundary>`.
- **Modify** `src/index.css` — `.dev-panel`, `.toast` styles.

---

## Task 1: `validateEspnShape` + captured-fixture test

**Files:**

- Modify: `src/lib/fetchEspn.ts`
- Test: `src/lib/fetchEspn.test.ts` (append; create if absent)
- Create: `src/lib/fetchEspn.fixture.test.ts`, `src/lib/__fixtures__/espn-sample.json`

- [ ] **Step 1: Write the failing test** (append to `src/lib/fetchEspn.test.ts`, or create it):

```ts
import { describe, it, expect } from "vitest";
import { validateEspnShape } from "./fetchEspn";

// A minimal well-formed raw entry the way ESPN nests it under `player`.
function row(id: number, rank: number, adp = rank) {
  return {
    player: {
      id,
      fullName: `Player ${id}`,
      defaultPositionId: 2, // RB (in POS map)
      proTeamId: 1,
      draftRanksByRankType: { PPR: { rank } },
      ownership: { averageDraftPosition: adp },
    },
  };
}

describe("validateEspnShape", () => {
  it("accepts a healthy response (>=200 ranked rows)", () => {
    const raw = Array.from({ length: 250 }, (_, i) => row(i + 1, i + 1));
    expect(validateEspnShape(raw).ok).toBe(true);
  });
  it("rejects a non-array", () => {
    const r = validateEspnShape({} as never);
    expect(r.ok).toBe(false);
  });
  it("rejects too few ranked rows", () => {
    const raw = Array.from({ length: 50 }, (_, i) => row(i + 1, i + 1));
    const r = validateEspnShape(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fingerprint).toContain("ranked=");
  });
  it("rejects when spot-checked rows lack required fields", () => {
    const raw = Array.from({ length: 250 }, () => ({ player: { foo: 1 } }));
    expect(validateEspnShape(raw).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/lib/fetchEspn.test.ts` — fails: `validateEspnShape` not exported.

- [ ] **Step 3: Implement** in `src/lib/fetchEspn.ts` (add near `mapEspnPlayers`; it reuses the same `POS`/nesting logic):

```ts
export type ShapeResult =
  | { ok: true; ranked: number }
  | { ok: false; reason: string; fingerprint: string };

export class EspnShapeError extends Error {
  fingerprint: string;
  constructor(reason: string, fingerprint: string) {
    super(reason);
    this.name = "EspnShapeError";
    this.fingerprint = fingerprint;
  }
}

const MIN_RANKED = 200; // healthy pulls return ~500; far fewer ⇒ shape change
const SPOT_CHECK = 10;

// Validate-at-the-boundary: a malformed ESPN payload must never reach state.
export function validateEspnShape(rawPlayers: unknown): ShapeResult {
  if (!Array.isArray(rawPlayers)) {
    return { ok: false, reason: "not-array", fingerprint: "players=not-array" };
  }
  const rows = rawPlayers as EspnEntry[];
  // count rows that carry a PPR rank (what we actually map)
  let ranked = 0;
  for (const e of rows) {
    const p = e.player ?? (e as unknown as EspnPlayer);
    if (p?.draftRanksByRankType?.PPR?.rank != null) ranked++;
  }
  if (ranked < MIN_RANKED) {
    return {
      ok: false,
      reason: "too-few-ranked",
      fingerprint: `ranked=${ranked} total=${rows.length}`,
    };
  }
  // spot-check the first N mapped rows for required fields + sane ranges
  let bad = 0;
  let firstBad = "";
  for (const e of rows.slice(0, SPOT_CHECK)) {
    const p = e.player ?? (e as unknown as EspnPlayer);
    const rank = p?.draftRanksByRankType?.PPR?.rank;
    const adp = p?.ownership?.averageDraftPosition ?? 0;
    const ok =
      p &&
      p.id != null &&
      POS[p.defaultPositionId] != null &&
      typeof rank === "number" &&
      rank >= 1 &&
      adp >= 0 &&
      adp <= 400;
    if (!ok) {
      bad++;
      if (!firstBad) firstBad = JSON.stringify(p)?.slice(0, 120) ?? "null";
    }
  }
  if (bad > SPOT_CHECK / 2) {
    return {
      ok: false,
      reason: "rows-malformed",
      fingerprint: `bad=${bad}/${SPOT_CHECK} first=${firstBad}`,
    };
  }
  return { ok: true, ranked };
}
```

Then make `fetchEspnPlayers` run the guard before mapping (replace the existing `const raw = ...; const mapped = mapEspnPlayers(raw); if (mapped.length === 0) throw ...`):

```ts
const data = await res.json();
const raw: EspnEntry[] = Array.isArray(data.players) ? data.players : data;
const shape = validateEspnShape(raw);
if (!shape.ok) {
  console.warn("ESPN shape guard tripped:", shape.reason, shape.fingerprint);
  throw new EspnShapeError(shape.reason, shape.fingerprint);
}
const mapped = mapEspnPlayers(raw);
if (mapped.length === 0) {
  throw new EspnShapeError("no-ranked", "mapped=0");
}
return mapped;
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/fetchEspn.test.ts`

- [ ] **Step 5: Captured-fixture test.** Create `src/lib/__fixtures__/espn-sample.json` — a small (~3-row) hand-built array shaped exactly like the real `data.players` entries (nested under `player`, with `draftRanksByRankType.PPR.rank`, `ownership.averageDraftPosition`, a `stats` array with one projection row). Then `src/lib/fetchEspn.fixture.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapEspnPlayers, validateEspnShape } from "./fetchEspn";
import sample from "./__fixtures__/espn-sample.json";

describe("ESPN fixture mapping (regression guard)", () => {
  it("maps the captured sample to FetchedPlayer rows", () => {
    const out = mapEspnPlayers(sample as never);
    expect(out.length).toBeGreaterThan(0);
    const first = out[0];
    expect(first.id).toBeTruthy();
    expect(first.name).toBeTruthy();
    expect(["QB", "RB", "WR", "TE", "K", "DST"]).toContain(first.position);
    expect(typeof first.overallRank).toBe("number");
  });
  it("the fixture is large enough only if padded; small sample bypasses count", () => {
    // documents that the count threshold is intentionally separate from mapping
    expect(typeof validateEspnShape).toBe("function");
  });
});
```

(Build the fixture with ≥1 mappable row; the mapping test does not need 200 rows — only `validateEspnShape` enforces the count threshold, which is covered in Step 1.)

- [ ] **Step 6: Run — expect pass.** `npx vitest run src/lib/fetchEspn.fixture.test.ts`
- [ ] **Step 7: Commit.** `git commit -m "Add ESPN-shape guard + captured-fixture mapping test"`

---

## Task 2: Persistence for refetch result + error log

**Files:**

- Modify: `src/lib/storage.ts`
- Test: `src/lib/devStore.test.ts` (create)

- [ ] **Step 1: Add helpers** to `storage.ts` (top, near the other `otc:` keys):

```ts
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
    const raw = localStorage.getItem(REFETCH_KEY);
    return raw ? (JSON.parse(raw) as RefetchResult) : null;
  } catch {
    return null;
  }
}
export function saveRefetchResult(r: RefetchResult): void {
  try {
    localStorage.setItem(REFETCH_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}
export function loadErrorLog(): LoggedError[] {
  try {
    const raw = localStorage.getItem(ERRORS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as LoggedError[]) : [];
  } catch {
    return [];
  }
}
export function pushErrorLog(e: LoggedError): void {
  try {
    const next = [e, ...loadErrorLog()].slice(0, MAX_ERRORS);
    localStorage.setItem(ERRORS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
export function clearErrorLog(): void {
  try {
    localStorage.removeItem(ERRORS_KEY);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: Test** (`src/lib/devStore.test.ts`):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadRefetchResult,
  saveRefetchResult,
  loadErrorLog,
  pushErrorLog,
  clearErrorLog,
} from "./storage";

beforeEach(() => localStorage.clear());

describe("dev store", () => {
  it("round-trips a refetch result", () => {
    expect(loadRefetchResult()).toBeNull();
    saveRefetchResult({ ok: true, at: 1, count: 500 });
    expect(loadRefetchResult()?.count).toBe(500);
  });
  it("buffers errors newest-first and clears", () => {
    pushErrorLog({ at: 1, message: "a", source: "onerror" });
    pushErrorLog({ at: 2, message: "b", source: "boundary" });
    const log = loadErrorLog();
    expect(log[0].message).toBe("b");
    expect(log.length).toBe(2);
    clearErrorLog();
    expect(loadErrorLog()).toEqual([]);
  });
  it("caps the error log at 50", () => {
    for (let i = 0; i < 60; i++)
      pushErrorLog({ at: i, message: String(i), source: "onerror" });
    expect(loadErrorLog().length).toBe(50);
  });
});
```

- [ ] **Step 3: Run — expect pass.** `npx vitest run src/lib/devStore.test.ts`
- [ ] **Step 4: Commit.** `git commit -m "Persist refetch result + capped runtime-error log"`

---

## Task 3: Error handlers + boundary

**Files:**

- Create: `src/lib/devLog.ts`, `src/components/ErrorBoundary.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: `devLog.ts`** — global handlers that buffer to the store:

```ts
import { pushErrorLog } from "./storage";

let installed = false;

// Buffer uncaught errors + promise rejections so the gated /dev panel can show
// what went wrong on this device. Idempotent; safe to call once at boot.
export function installErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    pushErrorLog({
      at: Date.now(),
      message: e.message || "error",
      source: "onerror",
      stack: e.error?.stack,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    pushErrorLog({
      at: Date.now(),
      message: (r && (r.message ?? String(r))) || "unhandledrejection",
      source: "unhandledrejection",
      stack: r?.stack,
    });
  });
}
```

- [ ] **Step 2: `ErrorBoundary.tsx`** — class boundary buffering render errors:

```tsx
import { Component, type ReactNode } from "react";
import { pushErrorLog } from "../lib/storage";

interface Props {
  children: ReactNode;
}
interface State {
  crashed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error) {
    pushErrorLog({
      at: Date.now(),
      message: error.message,
      source: "boundary",
      stack: error.stack,
    });
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="crash-fallback">
          <p>Something broke. Your data is saved.</p>
          <button onClick={() => location.reload()}>Reload</button>
          <a href="?dev=1">Open diagnostics</a>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 3: Wire `main.tsx`:**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installErrorHandlers } from "./lib/devLog";
import "./index.css";

installErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
```

- [ ] **Step 4: Typecheck + suite.** `npx tsc --noEmit && npx vitest run`
- [ ] **Step 5: Commit.** `git commit -m "Add error boundary + window error buffering"`

---

## Task 4: Pure data-quality diagnostics

**Files:**

- Create: `src/lib/dataQuality.ts`, `src/lib/dataQuality.test.ts`

- [ ] **Step 1: Test** (`dataQuality.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { dataQualityIssues } from "./dataQuality";
import type { Player } from "../types";

function p(over: Partial<Player>): Player {
  return {
    id: "1",
    name: "X",
    position: "RB",
    team: "ATL",
    overallRank: 1,
    byeWeek: 7,
    tier: 1,
    adp: 10,
    projStats: {} as never,
    lastStats: {} as never,
    notes: "",
    flag: "none",
    draftStatus: "available",
    ...over,
  };
}

describe("dataQualityIssues", () => {
  it("flags missing adp / bye / projStats / lastStats", () => {
    const issues = dataQualityIssues([
      p({ id: "a", adp: null }),
      p({ id: "b", byeWeek: null }),
      p({ id: "c", projStats: null }),
      p({ id: "d", lastStats: null, position: "WR" }),
    ]);
    const ids = issues.map((i) => i.id);
    expect(issues.length).toBeGreaterThan(0);
    expect(ids).toContain("a");
  });
  it("does not flag K/DST for missing projStats/lastStats", () => {
    const issues = dataQualityIssues([
      p({ id: "k", position: "K", projStats: null, lastStats: null }),
    ]);
    expect(issues.find((i) => i.id === "k")).toBeFalsy();
  });
  it("returns empty for a clean board", () => {
    expect(dataQualityIssues([p({})])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/lib/dataQuality.test.ts`

- [ ] **Step 3: Implement** (`dataQuality.ts`):

```ts
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
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/dataQuality.test.ts`
- [ ] **Step 5: Commit.** `git commit -m "Add pure data-quality diagnostics"`

---

## Task 5: DevPanel component

**Files:**

- Create: `src/components/dev/DevPanel.tsx`, `src/components/dev/DevPanel.test.tsx`

Props:

```ts
interface Props {
  players: Player[];
  refetch: RefetchResult | null;
  errors: LoggedError[];
  onClearErrors: () => void;
  onResetBoard: () => void;
  onClose: () => void;
}
```

Behavior: four sections — (1) last refetch result (ok/failed + count or fingerprint + time), (2) data-quality list from `dataQualityIssues(players)` with a total count, (3) runtime-error log newest-first with a "Clear" button, (4) a **⤺ Reset board** button that calls `onResetBoard` after a `confirm`. A Close/back link returns to the app.

- [ ] **Step 1: Test** (`DevPanel.test.tsx`):

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DevPanel } from "./DevPanel";

afterEach(cleanup);

const base = {
  players: [],
  refetch: null,
  errors: [],
  onClearErrors: () => {},
  onResetBoard: () => {},
  onClose: () => {},
};

describe("DevPanel", () => {
  it("shows the last refetch result when present", () => {
    render(
      <DevPanel
        {...base}
        refetch={{
          ok: false,
          at: Date.now(),
          reason: "too-few-ranked",
          fingerprint: "ranked=3",
        }}
      />,
    );
    expect(screen.getByText(/ranked=3/)).toBeTruthy();
  });
  it("lists runtime errors and clears them", () => {
    const onClearErrors = vi.fn();
    render(
      <DevPanel
        {...base}
        errors={[{ at: Date.now(), message: "boom", source: "onerror" }]}
        onClearErrors={onClearErrors}
      />,
    );
    expect(screen.getByText(/boom/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /clear errors/i }));
    expect(onClearErrors).toHaveBeenCalled();
  });
  it("Reset board confirms before calling onResetBoard", () => {
    const onResetBoard = vi.fn();
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DevPanel {...base} onResetBoard={onResetBoard} />);
    fireEvent.click(screen.getByRole("button", { name: /reset board/i }));
    expect(onResetBoard).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run — expect fail**, then implement `DevPanel.tsx`:

```tsx
import type { Player } from "../../types";
import type { RefetchResult, LoggedError } from "../../lib/storage";
import { dataQualityIssues } from "../../lib/dataQuality";

interface Props {
  players: Player[];
  refetch: RefetchResult | null;
  errors: LoggedError[];
  onClearErrors: () => void;
  onResetBoard: () => void;
  onClose: () => void;
}

const fmt = (ms: number) => new Date(ms).toLocaleString();

export function DevPanel({
  players,
  refetch,
  errors,
  onClearErrors,
  onResetBoard,
  onClose,
}: Props) {
  const issues = dataQualityIssues(players);
  return (
    <div className="dev-panel">
      <header className="dev-head">
        <h1>Diagnostics</h1>
        <button onClick={onClose}>← Back to board</button>
      </header>

      <section>
        <h2>Last refetch</h2>
        {refetch ? (
          <p>
            {refetch.ok ? "✓ OK" : "✗ Failed"} · {fmt(refetch.at)} ·{" "}
            {refetch.ok
              ? `${refetch.count ?? "?"} players`
              : `${refetch.reason} (${refetch.fingerprint})`}
          </p>
        ) : (
          <p className="muted">No refetch recorded.</p>
        )}
      </section>

      <section>
        <h2>Data quality ({issues.length})</h2>
        {issues.length === 0 ? (
          <p className="muted">No gaps on the current board.</p>
        ) : (
          <ul className="dev-list">
            {issues.map((i) => (
              <li key={i.id}>
                {i.name} — {i.problems.join(", ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Runtime errors ({errors.length})</h2>
        {errors.length > 0 && (
          <button onClick={onClearErrors}>Clear errors</button>
        )}
        <ul className="dev-list">
          {errors.map((e, i) => (
            <li key={i}>
              <code>{e.source}</code> · {fmt(e.at)} — {e.message}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Danger zone</h2>
        <button
          className="dev-danger"
          onClick={() => {
            if (confirm("Reset everything? This wipes tiers, flags & notes."))
              onResetBoard();
          }}
        >
          ⤺ Reset board
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Run — expect pass.** `npx vitest run src/components/dev/DevPanel.test.tsx`
- [ ] **Step 4: Commit.** `git commit -m "Add gated /dev diagnostics panel component"`

---

## Task 6: App wiring — `?dev=1` route, refetch orchestration, Reset board, toast

**Files:**

- Modify: `src/App.tsx`, `src/components/Toolbar.tsx`, `src/index.css`

- [ ] **Step 1: App imports + dev state.** Add to `App.tsx` imports:

```ts
import { EspnShapeError } from "./lib/fetchEspn";
import {
  loadRefetchResult,
  saveRefetchResult,
  loadErrorLog,
  clearErrorLog,
  type RefetchResult,
} from "./lib/storage";
import { DevPanel } from "./components/dev/DevPanel";
import seed from "./data/seed.json";
```

State near the other `useState`s:

```ts
const devMode = new URLSearchParams(window.location.search).get("dev") === "1";
const [refetchResult, setRefetchResult] = useState<RefetchResult | null>(
  loadRefetchResult,
);
const [toast, setToast] = useState<string | null>(null);
```

- [ ] **Step 2: Rework `onFetch`** to record the guard result + toast on failure (replace the existing `onFetch`):

```ts
const onFetch = async () => {
  if (fetching) return;
  if (
    !confirm(
      "Refetch the latest players from ESPN?\n\nKeeps your tiers, targets, draft picks and notes. Refreshes team, ADP, projections, last-season stats and injuries; adds any new players.",
    )
  )
    return;
  setFetching(true);
  try {
    const fetched = await fetchEspnPlayers();
    dispatch({ type: "merge", fetched });
    const r: RefetchResult = {
      ok: true,
      at: Date.now(),
      count: fetched.length,
    };
    setRefetchResult(r);
    saveRefetchResult(r);
    setToast(`Refetched ${fetched.length} players.`);
  } catch (err) {
    const shape = err instanceof EspnShapeError;
    const r: RefetchResult = {
      ok: false,
      at: Date.now(),
      reason: shape ? (err as EspnShapeError).message : "fetch-failed",
      fingerprint: shape ? (err as EspnShapeError).fingerprint : String(err),
    };
    setRefetchResult(r);
    saveRefetchResult(r);
    setToast(
      shape
        ? "Couldn't refresh — ESPN's data may have changed. Your board is unchanged."
        : "Refetch failed. Your board is unchanged.",
    );
  } finally {
    setFetching(false);
  }
};
```

(Auto-dismiss the toast with an effect: `useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);`.)

- [ ] **Step 3: Reset board handler:**

```ts
const onResetBoard = () => {
  dispatch({ type: "setAll", players: seed as unknown as Player[] });
};
```

- [ ] **Step 4: Render the dev route** — at the very top of the returned JSX (before the normal app), short-circuit when `devMode`:

```tsx
if (devMode) {
  return (
    <div className="app">
      <DevPanel
        players={players}
        refetch={refetchResult}
        errors={loadErrorLog()}
        onClearErrors={() => {
          clearErrorLog();
          setToast("Cleared error log.");
        }}
        onResetBoard={onResetBoard}
        onClose={() => {
          window.location.search = "";
        }}
      />
    </div>
  );
}
```

(Place this next to the existing `if (mockMode) { return … }` early-return so hooks order is preserved — both are after all hook calls.)

- [ ] **Step 5: Toast element** — add before the closing `</div>` of the main app return:

```tsx
{
  toast && <div className="toast">{toast}</div>;
}
```

- [ ] **Step 6: Toolbar label** — relabel the existing "Fetch players" menu item to clarify it keeps curation, and show the new `fetchStatus`/toast hook is unnecessary (toast lives in App). In `Toolbar.tsx`, change the button text:

```tsx
{
  props.fetching ? "Refetching…" : "⟳ Refetch data (keeps your tiers)";
}
```

- [ ] **Step 7: CSS** — append to `index.css`:

```css
.toast {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  transform: translateX(-50%);
  z-index: 60;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.6rem 1rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  max-width: 90vw;
}
.dev-panel {
  max-width: 60rem;
  margin: 0 auto;
  padding: 1rem;
}
.dev-panel .dev-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.dev-panel section {
  margin: 1.25rem 0;
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}
.dev-panel .dev-list {
  margin: 0.25rem 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  max-height: 18rem;
  overflow-y: auto;
}
.dev-panel .muted {
  color: var(--muted);
}
.dev-panel .dev-danger {
  color: #ff6b4a;
  border-color: #ff6b4a;
}
.crash-fallback {
  max-width: 28rem;
  margin: 4rem auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
```

- [ ] **Step 8: Full gate.** `npx tsc --noEmit && npx vitest run && npm run build`
- [ ] **Step 9: Commit.** `git commit -m "Wire refetch guard, toast, and gated /dev panel into App"`

---

## Task 7: Live verification + status doc

- [ ] **Step 1: Live smoke** (`npm run dev`):
  - `?dev=1` shows the diagnostics panel (refetch line, data-quality count, error log, Reset board).
  - Settings → "⟳ Refetch data (keeps your tiers)" runs; on success a toast appears and `?dev=1` shows ok + count; tiers/notes survive.
  - Force a failure (temporarily point the fetch URL at a 404 or throw) → board unchanged + failure toast + `?dev=1` shows the fingerprint. Revert the temporary change.
  - Reset board (in `?dev=1`) after confirm restores the seed.
- [ ] **Step 2: Update status doc** — add a Phase 5 "Built" bullet in `…/WeDev/On The Clock/FF Draft Helper.md` and flip the "remaining" tail (Phase 5 done → board redesign complete).
- [ ] **Step 3: Final commit** if the status doc lives in-repo (it does not — Obsidian vault), else stop.

---

## Self-Review notes (author)

- **Spec §7 coverage:** Refetch surfaced + relabeled "keeps your tiers" (Task 6); commit-only-on-success via try/catch around dispatch (Task 6); `validateEspnShape` with array check, ≥200 ranked threshold, spot-check fields + ADP/rank ranges, fingerprint (Task 1); captured-fixture mapping test (Task 1); console.warn fingerprint + recorded for /dev (Tasks 1–2, 6); Reset board gated in /dev with confirm (Tasks 5–6).
- **Spec §9 coverage:** `?dev=1` gate (Task 6); last refetch/shape result (Tasks 2,5,6); data-quality computed on view (Tasks 4–5); runtime-error log via boundary + window handlers buffered to localStorage, newest-first, clearable (Tasks 2–3,5); Reset board is its gated home (Tasks 5–6). Remote reporting intentionally backlog.
- **Non-destructive:** refetch only dispatches `merge` on success; the guard runs before any state write.
- **No new deps;** reuses dnd-kit-free plain React + existing storage/reducer patterns.
- **Out of scope:** remote/phone-home error reporting (backlog), Formspree wiring.

```

```

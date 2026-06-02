# Multiple Tier Lists per League — Implementation Plan (Foundation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each `League` multiple named tier lists (one default, one active) instead of a single `board`, so the user can author alternates ("Balanced", "RB-heavy") and switch between them in the board view. Spec: `docs/superpowers/specs/2026-06-01-multiple-tier-lists-per-league-design.md`.

**Architecture:** Pure data + reducer changes (TDD), a storage migration (`leagues:v1 → leagues:v2`, TDD), then thin UI wiring (build + live-verify). Player/tier actions keep flowing through `rankingReducer`, now retargeted to the active tier list's board. The old `boardReducer` "named lists" pattern is reused nested in each league, but keyed by stable `id` so rename can't orphan references.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest (jsdom). Run a file with `npx vitest run <file>`; full typecheck/build with `npm run build`.

---

## File Structure

- `src/types.ts` (modify) — add `TierList`; replace `League.board` with `tierLists` / `activeTierListId` / `defaultTierListId`.
- `src/lib/league.ts` (modify) — `makeLeague` seeds one "Default" list; add `activeTierList`, `activeBoard`, `defaultBoard` accessors; `migrateBoardToLeagues` builds v2 leagues.
- `src/lib/league.test.ts` (modify) — accessors + updated makeLeague/migrate tests.
- `src/state/reducer.ts` (modify) — `TierListAction`; retarget the default (player/tier) case to the active list; normalize active list on `switchLeague`; deep-clone `tierLists` in `duplicateLeague`.
- `src/state/reducer.test.ts` (modify) — TierListAction + retargeting + duplicate-independence tests.
- `src/lib/storage.ts` (modify) — `leagues:v2` key; `migrateLeaguesV1toV2`; `readLeagues`/`loadLeagues`/`saveLeagues` on v2.
- `src/lib/storage.test.ts` (modify) — v1→v2 migration, idempotency, round-trip.
- `src/state/useRankings.ts` (modify) — `players: activeBoard(current)`; expose tier-list summary + ids.
- `src/lib/mock/engine.ts` (modify) — `createMock` reads `defaultBoard(league)`.
- `src/components/Toolbar.tsx` (modify) — tier-list switcher + manage menu.
- `src/App.tsx` (modify) — pass tier-list props/handlers to Toolbar.
- `src/index.css` (modify) — minimal styles for the switcher/menu.

---

## Task 1: Types — `TierList` and reshaped `League`

**Files:** modify `src/types.ts`

- [ ] Add `TierList { id: string; name: string; board: Player[] }`.
- [ ] On `League`, replace `board: Player[]` with `tierLists: TierList[]`, `activeTierListId: string`, `defaultTierListId: string`. Keep all other fields.

Compile will break across the repo — that's expected; the following tasks fix each consumer. No test of its own.

---

## Task 2: Accessors + `makeLeague` (TDD)

**Files:** modify `src/lib/league.ts`, `src/lib/league.test.ts`

- [ ] **Failing tests** in `league.test.ts`:
  - `makeLeague` builds exactly one tier list named "Default"; `activeTierListId === defaultTierListId === tierLists[0].id`; passing `board` seeds that list's board; default board is `[]`.
  - `activeTierList(l)` returns the list whose id is `activeTierListId`; falls back to `tierLists[0]` when the id is missing.
  - `activeBoard(l)` / `defaultBoard(l)` return the corresponding `.board`, with the same fallback.
- [ ] **Implement** in `league.ts`:
  - `makeLeague` builds `const id = crypto.randomUUID()` for the list, `tierLists: [{ id, name: "Default", board: opts.board ?? [] }]`, `activeTierListId: id`, `defaultTierListId: id`. (Keep the separate league `id`.)
  - `activeTierList(l)`, `activeBoard(l)`, `defaultBoard(l)` with `?? l.tierLists[0]` fallback.
  - `migrateBoardToLeagues` already calls `makeLeague({ name, board })`, so each migrated league gets a wrapped "Default" list for free — update its test expectations to read `activeBoard(league)` instead of `.board`.

---

## Task 3: Reducer — `TierListAction` + retargeting (TDD)

**Files:** modify `src/state/reducer.ts`, `src/state/reducer.test.ts`

- [ ] **Failing tests** in `reducer.test.ts` (operate on the current league):
  - `switchTierList`: sets `activeTierListId`; normalizes that list's board (tiers + byes); no-op for unknown id.
  - `addTierList`: appends a list seeded from the ADP seed (normalized), makes it active; given name used.
  - `duplicateTierList`: copies the active list's board into a new id+name and makes it active; editing one list later does not change the other (independent deep copy).
  - `renameTierList`: renames the active list; no-op on empty name.
  - `deleteTierList`: removes by id; **refuses** when only one remains; if the deleted list was active/default, reassigns active/default to a surviving list.
  - `setDefaultTierList`: sets `defaultTierListId`; no-op for unknown id.
  - default (player/tier) case: a `move`/`update` targets only the **active** list's board of the current league; other lists untouched; `updatedAt` bumps; unchanged board ⇒ same state reference (skip).
  - `switchLeague`: normalizes the **active tier list's** board of the target league.
  - `duplicateLeague`: deep-copies every tier list with **new ids**; carries default/active by mapping old→new ids; editing the source's lists doesn't change the copy.
- [ ] **Implement**:
  - Add `TierListAction` union; thread it through `leaguesReducer`'s action type.
  - Helper `mapActiveTierList(league, fn)` (read active list, apply `fn` to its board, write back by id) and `replaceTierLists`.
  - Default case: `const active = activeTierList(current); const board = rankingReducer(active.board, action); if (board === active.board) return state;` write back into that list by id + bump `updatedAt`.
  - `switchLeague`: normalize via `mapActiveTierList(target, normalizeWith)` (tiers + byes).
  - `duplicateLeague`: build an id-remap, clone `tierLists` with fresh ids and copied boards, set active/default through the remap.
  - `addTierList` seeds from `seed.json` ordered/normalized (mirror storage's fresh-board path) — import the seed the same way storage does.

---

## Task 4: Storage `leagues:v2` migration (TDD)

**Files:** modify `src/lib/storage.ts`, `src/lib/storage.test.ts`

- [ ] **Failing tests** in `storage.test.ts`:
  - `migrateLeaguesV1toV2`: a v1 league with `.board` becomes one league with `tierLists:[{name:"Default", board}]`, `activeTierListId === defaultTierListId`; old `board` dropped; **all** leagues preserved; `currentId` kept.
  - idempotent: a league already carrying `tierLists` passes through unchanged.
  - `saveLeagues`/`loadLeagues` round-trip through v2 (write v2, read it back, active list's board normalized for immediate use).
  - when v2 absent but v1 present, `loadLeagues` migrates v1→v2; when both absent, falls back through `migrateBoardToLeagues(readBoard())` upgraded to v2.
- [ ] **Implement**:
  - `LEAGUES_KEY_V2 = "ff-cheat-sheet:leagues:v2"`, keep `..:v1` constant for reads.
  - `migrateLeaguesV1toV2(state)`: map each league — if it has `tierLists` keep it; else wrap `board`.
  - `readLeagues`: try v2; else v1 → `migrateLeaguesV1toV2`; else `migrateBoardToLeagues(readBoard())` (already v2 via Task 2).
  - `saveLeagues` writes v2. `loadLeagues` normalizes the **active tier list** of the current league via `activeBoard`/write-back.

---

## Task 5: UI wiring + mock engine (build + live-verify)

**Files:** modify `src/state/useRankings.ts`, `src/lib/mock/engine.ts`, `src/components/Toolbar.tsx`, `src/App.tsx`, `src/index.css`

- [ ] `useRankings`: `players: activeBoard(current)`; also return `tierLists: current.tierLists.map(({id,name})=>({id,name}))`, `activeTierListId`, `defaultTierListId`.
- [ ] `mock/engine.createMock`: replace `league.board` with `defaultBoard(league)`.
- [ ] `Toolbar`: add a tier-list switcher (active name + "default" marker) and a manage menu beside the league controls — Switch, New, Duplicate current, Rename, Delete (disabled when one list), Set as default. New props + handlers mirror the existing league menu.
- [ ] `App`: dispatch the matching `TierListAction`s; pass summary/ids/handlers to Toolbar.
- [ ] `src/index.css`: minimal styles consistent with the league switcher.
- [ ] **Live verify** (`npm run dev`): switch lists; duplicate → re-tier the copy → confirm the original is unchanged; reload → persists (v2); start a mock → seeded from the default list.

---

## Done When

- `npm run build` passes (typecheck + bundle).
- All new + existing Vitest tests pass (`npx vitest run`).
- Live checks in Task 5 confirmed.

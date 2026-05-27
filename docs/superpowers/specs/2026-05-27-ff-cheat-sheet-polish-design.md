# FF Cheat Sheet — Draft-Night Polish (v1 ship) — Design

**Date:** 2026-05-27
**Status:** Approved
**Supersedes (in part):** `2026-05-24-ff-cheat-sheet-design.md` — that spec's "in-app editing of all player fields" is replaced by the locked-fields rule below, and its boolean `drafted` becomes the tri-state `draftStatus` below.

## Purpose

Polish the existing ranking board into a draft-night tool worth shipping publicly on Kendall's portfolio. The app stays self-contained — pre-seeded data + localStorage, no external APIs, no accounts. Each visitor uses it standalone in their own browser.

This milestone is also the live worked example for the portfolio article "How I Actually Work With AI."

> **No backward compatibility required.** The app has no users and no saved data to protect yet, so we make clean breaking changes (no migration code, no legacy import handling) and simply update the seed + generator.

## Scope

**In scope (this milestone):**

- **Dark mode only** — single dark palette; light styles removed.
- **Locked fields** — seeded players' `name`, `position`, `team`, `adp` are read-only. Editable: your rank (drag), `tier`, `notes`, `flag`, `draftStatus`.
- **Two-number model** — your rank `#` (set by dragging) is the primary order; consensus `adp` shown read-only beside it.
- **Tri-state draft status** — each player is `available` / `mine` / `taken` (drafted by someone else). One cell cycles through the three.
- **Positional drafted counter** — a board-wide summary of how many players at each position are off the board (`mine` + `taken`), to reveal positional runs.
- **Delayed hide + undo** — when "hide drafted" is on, marking a player drafted lingers ~2.5s (fade/collapse + Undo) before hiding.
- **Default bye weeks** — populated from a static team-metadata module.
- **Row layout** — draft cell first, then rank `#`; name narrower, notes wider, flag column narrow; delete button removed.
- **Row colors** (dark): see table below.
- **Smart search** — match name + team abbrev + team city/nickname; exact before partial; team queries surface the D/ST first.
- **Injury badges** — small Q/D/O/IR/SUS badge on injured players (from ESPN `injuryStatus`); healthy players show nothing.

**Out of scope → roadmap (explicitly deferred):**

- Suggested picks / draft recommendations.
- Multi-source ADP (ESPN/Yahoo/Sleeper/Vegas) and per-source color/icons.
- Fuller live draft tracker: draft order / snake math, roster-needs hints, my-roster breakdown. (This milestone includes only the contained slice: per-player draft status + board-wide positional counts.)
- Mock-draft engine, accounts/profiles/sync, player news, depth charts, projections, VOR, custom scoring.

## Data model & team metadata

- **`drafted: boolean` → `draftStatus: "available" | "mine" | "taken"`** on `Player`. Clean replacement — no migration.
- Update **`src/data/seed.json`** and **`scripts/fetch-espn.mjs`** to emit `draftStatus: "available"` instead of `drafted: false`.
- CSV/JSON import/export speak `draftStatus` directly (no legacy boolean).
- New static module **`teamMeta`**: `abbrev → { city, nickname, byeWeek }` for all 32 teams + a `"FA"` fallback. Single source of truth for bye weeks and team-name search. `byeWeek` is filled from here on load (seed has `null`).
- **Bye weeks** sourced from ESPN (`?view=proTeamSchedules_wl` → `settings.proTeams[].byeWeek`) for 2026 — real values, not invented.
- **`injuryStatus?: string`** (raw ESPN value, e.g. `"QUESTIONABLE"`) on `Player`. The generator emits it for non-`ACTIVE` players; a tested `injuryBadge()` maps it to a short code + severity at display time. Not user-editable and not part of CSV.

## Injury status

- Badge mapping: `QUESTIONABLE → Q`, `DOUBTFUL → D`, `OUT → O`, `INJURY_RESERVE → IR`, `SUSPENSION → SUS`. `ACTIVE`/healthy/unknown → no badge.
- Severity drives color: minor (Q, D) = amber; major (O, IR, SUS) = red.
- It's a **snapshot** captured when the seed is generated; refreshed by re-running `scripts/fetch-espn.mjs`.

## Locked fields

- Seeded rows: `name` / `position` / `team` / `adp` render as text, not inputs.
- Custom players (via `AddPlayerForm`): set at creation, then locked like the rest.
- `adp` is never typed; your **rank** changes only by dragging.

## Draft status & counts

- **Tri-state cell** cycles `available → mine → taken → available` on tap. Color encodes state (see below) so the current state is readable at a glance.
- **"Hide drafted"** hides any non-`available` player (both `mine` and `taken`).
- **Positional counter:** compute, across the whole list, how many players per position are non-`available`. Display a compact summary (e.g. `RB 8 · WR 6 · TE 2 · QB 3 · K 0 · DST 1`). Pure function over the player list; recomputed on change.

## Row layout

```
[draft ●] [# rank] [POS·TM] [Player name — narrower] [BYE] [ADP — read-only] [notes — wider] [⚑ flag]
```

Draft cell first, rank `#` second. Notes wider; name and flag columns narrower. Delete control removed.

## Color states (dark mode)

Precedence: **draft status (mine/taken) overrides flag color.**

| Condition                         | Color         |
| --------------------------------- | ------------- |
| `draftStatus === "mine"`          | green         |
| `draftStatus === "taken"`         | grey + dimmed |
| `available` & `flag === "target"` | purple        |
| `available` & `flag === "avoid"`  | red           |
| otherwise                         | neutral       |

A single pure function maps `{ draftStatus, flag }` → visual state, so precedence is testable in isolation.

## Delayed hide + undo

- Applies only when "hide drafted" is active.
- On marking a player `mine`/`taken`, the row enters a transient **pending-hide** state: it stays ~2.5s with a fade/collapse animation and an **Undo** affordance, then hides.
- Setting the player back to `available` (via Undo or the draft cell) during the window cancels the hide.
- The pending-hide timing/animation lives in component state; the underlying data updates immediately. Duration is a single tunable constant.

## Search

- Match player `name`, team `abbrev`, team `city`/`nickname` (via `teamMeta`).
- Rank exact (case-insensitive) before partial; team-name queries (e.g. "Steelers") surface the **D/ST** above that team's players.
- Pure ranking function over the list; no reducer change.

## Theme

Dark only. Light styles removed. No toggle this milestone.

## Data & season

- Ship on the **2026 seed** — confirmed via `scripts/fetch-espn.mjs` (`const SEASON = 2026`) and 2026 rookies in the data (e.g. Jeremiyah Love). This is the upcoming season and Kendall's real draft.
- Populate **2026** bye weeks in `teamMeta` from the official 2026 NFL schedule.
- Refreshable via `scripts/fetch-espn.mjs` as ADP firms up (manual pre-season step, not part of this milestone).

## Testing (TDD)

New / updated unit tests:

- `draftStatus` cycle logic (available → mine → taken → available).
- CSV/JSON round-trip carries `draftStatus`.
- Positional drafted counter: counts non-`available` per position correctly.
- Row visual-state function: precedence (mine/taken over flag), each flag → correct color.
- `teamMeta` bye-week population (load fills `byeWeek`; `"FA"` handled).
- Search ranking: exact-before-partial; team-name query returns D/ST first.
- Locked-field enforcement: seeded rows expose no editable `name`/`position`/`team`/`adp`.
- Delayed hide: the **pending-hide state machine** is unit-tested with fake timers (enter pending → elapse → hidden; undo within window → cancelled). Animation itself verified manually.
- `injuryBadge` mapping: each ESPN status → correct short code + severity; `ACTIVE`/`undefined` → no badge.

Existing `ranking` / `csv` / `storage` / `reducer` tests updated for `draftStatus` and kept green.

## Open questions

None. Season is 2026; bye weeks sourced from the official 2026 schedule during implementation.

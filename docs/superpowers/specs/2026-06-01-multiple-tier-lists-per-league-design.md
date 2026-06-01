# Multiple Tier Lists per League — Design (Foundation)

**Date:** 2026-06-01
**Status:** Approved (brainstorming complete)
**Scope:** Foundation only. A follow-on spec covers the mock-draft tier view that consumes this.

## Goal

Decouple "a draft" from "one fixed board." A league should own **multiple named tier lists** (e.g. "Balanced", "RB-heavy", "WR catch-up"), one marked **default**, so the user can author alternates and switch between them — in the board view now, and (next plan) live during a mock draft.

## Background

Today a `League` *is* a single board: `League.board: Player[]`, where each player carries a `tier`. The reducer is layered — `rankingReducer(Player[], Action)` does player/tier ops; `leaguesReducer` delegates player actions to the current league's `board`. The old `boardReducer` already implements "named lists" (superseded by leagues); we reuse that *pattern* nested inside each league, but with stable **ids** (so rename can't orphan references).

`.board` is read in only a few places: `useRankings` (`players: current.board`), `leaguesReducer` (default case + `switchLeague`), `storage.loadLeagues`, `league.duplicateLeague`, and `mock/engine.createMock`.

## Data Model

    // src/types.ts
    export interface TierList {
      id: string;
      name: string;
      board: Player[];
    }

    export interface League {
      id, name, platform, scoring, tePremium, teams, roster,
      tierLists: TierList[];       // replaces `board`
      activeTierListId: string;    // the list the board view shows/edits
      defaultTierListId: string;   // marked "default"; a mock starts from this
      updatedAt: number;
    }

Accessors (`src/lib/league.ts`): activeTierList(l), activeBoard(l), defaultBoard(l) — each falls back to tierLists[0] if the id is missing. `makeLeague` creates one tier list named "Default" with activeTierListId === defaultTierListId === that id.

## Migration (no data loss)

Storage key bumps leagues:v1 -> leagues:v2.
- readLeagues reads v2 first; if absent, reads v1 (leagues with .board) and runs migrateLeaguesV1toV2; else the existing migrateBoardToLeagues chain, upgraded to v2.
- migrateLeaguesV1toV2(state): each league with tierLists is kept; else wrap its board as tierLists:[{id, name:"Default", board}], activeTierListId = defaultTierListId = that id; drop old board.
- saveLeagues writes v2.

## Reducer

New TierListAction (operate on the current league): switchTierList, addTierList (seeded from ADP seed), duplicateTierList (copy that list's board), renameTierList, deleteTierList (refuse last; reassign active/default), setDefaultTierList.

Player/tier Actions (default case) target the ACTIVE tier list's board of the current league (read it, run rankingReducer, write back into that tierList by id, bump updatedAt; skip if unchanged). switchLeague normalizes the active tier list's board. duplicateLeague deep-copies tierLists (new ids) and carries default/active ids.

## App / UI Wiring

- useRankings: players: activeBoard(current).
- App: pass tier-list summary {id,name}[], activeTierListId, defaultTierListId + handlers to Toolbar.
- Toolbar: tier-list switcher + manage menu beside the league controls — Switch, New, Duplicate current, Rename, Delete, Set as default. Active list name shown, with a "default" marker.
- mock/engine.createMock: read defaultBoard(league) (a mock starts from the league's default list).

Everything operating on players/the board (export, import, fetch-merge, ADP refresh, tier drag) keeps working — it flows through the active tier list via the reducer.

## Out of scope (next spec)

The mock tier view (toggle Tiers/ADP, board selector to switch tier lists live mid-draft, grouping helper).

## Testing (TDD the pure layer)

- accessors (fallback when id missing); makeLeague (one "Default", active === default).
- migrateLeaguesV1toV2: v1 {board} -> one "Default" list; idempotent on v2; preserves all leagues.
- TierListAction: switch (active + normalize), add (seeded, active), duplicate (independent copy — editing one doesn't change the other), rename, delete (refuses last; reassigns active/default), setDefault.
- player action targets active list only; duplicateLeague clones lists independently.
- saveLeagues/loadLeagues round-trip through v2.

UI verified live (switch lists, duplicate -> re-tier -> confirm independence, persistence across reload).

# Draft Room Redesign — Handoff

Start-here doc for implementing the 2026 visual redesign. Read this, then the
design spec at `docs/design/draft-room/README.md`. The primary visual reference
is `docs/design/draft-room/Draft Room v3 (Unified).dc.html` — template markup
at the top, a React-style state class below it. The HTML files are **design
references, not code to copy**; recreate them with this codebase's patterns.
`Draft Board Explorations v2 (Dark).dc.html` holds the phone layouts for the
mobile stories.

Work one story at a time (list below), in order. Each story: own worktree +
branch, TDD for anything with logic, verify with `npx vitest run`,
`npx tsc --noEmit`, `npm run build`, then fast-forward merge to main and check
the story off here.

## Decisions (made with Kenny — do not relitigate)

1. **Tiers come from the user's tier breaks** (`src/lib/tierBreaks.ts`), never
   from ADP. The prototype's ADP-threshold tiers (`tierOf`) are sample-data
   scaffolding. Player lists default to "Sort by Tier" (board order,
   `overallRank`) with a toggle to "Sort by ADP"; tier bands hide in ADP mode.
2. **Star ★ = the existing `target` flag = queue membership.** The avoid flag
   ⊘ stays. The new piece is display: starred players appear in the My Queue
   panel in the draft room and auto-drop once drafted by anyone.
3. **Notes**: configurable column (already exists in `src/lib/columns.ts`);
   when a player has a note, show a small icon; **click** opens the popover —
   no hover behavior. Notes must remain editable.
4. **Home page first.** The redesign's "Players tab" look is the home research
   board, at slightly roomier density than the draft-room spec (research vs.
   in-draft). Then the draft room.
5. **No feature loss anywhere.** The mockup omits things the app has (pause,
   undo, replace-pick, VOR column, sounds, OnTheClockReveal, drag re-ranking,
   tier-break editing, column manager, avoid flags, notes). All survive,
   restyled. Removals are Kenny's call, later.
6. **Timer keeps current semantics** (runs only on the user's turn, pausable,
   auto-pick on expiry — `MockDraft.tsx:62-136`). The prototype's `0:38` is
   decorative.
7. **Fonts**: Archivo (500–800), Barlow Condensed (400–700), IBM Plex Mono
   (400/500/700) — **self-hosted** (offline drafts, no FOUT), not loaded from
   Google Fonts CDN.
8. **Position colors**: adopt the design's OKLCH position key (README "Position
   key" table) as the single source of truth in `src/lib/positionColor.ts`,
   mirrored to `--pos-*` CSS vars. Replaces the current hex palette.
9. **The Wall's round direction arrows** must derive from the real draft order
   (`src/lib/mock/order.ts` — snake with 3rd-round reversal), not the
   prototype's plain `r % 2` snake.
10. **TV mode** ships as a second-window cast on the same device
    (BroadcastChannel); cross-device casting is backlog.
11. **Deferred**: auction format, linear format, bot personalities,
    cross-device cast. The prototype's SIM control cluster (team stepper,
    SIM PICK, AUTO, UNDO, RESET) is demo scaffolding — do not build.

## Assumptions (Kenny can veto — flag before building on them)

- Player card overlay's VALUE stat (auction $ in the prototype) shows **VOR**
  in gold instead, since auction is deferred.
- PROJ/VOR render wherever data exists; the mock pick pool currently marks
  proj/vor "coming soon" (`MockDraft.tsx` extraCols). Wiring real data there
  is its own concern, not a redesign blocker.
- MockSetup / MockSummary / Intro screens get a tokens-only restyle (no
  redesign spec exists for them).
- The notes popover gains an edit affordance (today notes edit inline in the
  cell, `src/components/board/cells.tsx:164`).
- Mock team avatar colors map to the design's `AV` palette (user = gold
  `#D9A53F`).

## Stories

### Phase A — Home page (research board)

- [x] **A1. Design tokens + fonts.** App-global CSS vars for palette, OKLCH
      position key, type scale (README "Design Tokens"); self-host the three
      fonts; swap `positionColor.ts` to the new key. No layout changes — old
      screens just shift hue.
      _Done when: tokens exist, fonts load offline, app structurally unchanged,
      tests green._
- [ ] **A2. Header/wordmark restyle.** App bar treatment on home: wordmark
      with orange "Clock.", mono microlabel.
      _Done when: matches spec; existing nav/info links work._
- [ ] **A3. Table chrome.** Panel shell, tier bands (orange tick + "TIER N"
      from user tier breaks), row typography, position-hue labels, research
      density. All columns, drag re-ranking, tier-break editing, column manager,
      flags untouched. **Riskiest story** — it touches the board editor's drag
      interactions.
      _Done when: visual match; every current interaction still works._
- [ ] **A4. Toolbar restyle.** Search input, position chips, toggles in the
      new language.
      _Done when: visual match; filtering unchanged._
- [ ] **A5. Notes column rendering.** Icon when a note exists; click opens
      popover; editable; column show/hide via column manager (already supported).
      _Done when: icon + popover work, notes still editable._
- [ ] **A6. Sort toggle.** "Sort by Tier" (default) ↔ "Sort by ADP"; tier
      bands hide in ADP mode; choice persists.
      _Done when: toggle round-trips, default is tier._

### Phase B — Draft room

- [ ] **B1. Draft-room shell.** App bar variant: on-the-clock pill (gold when
      it's you), styled timer (current semantics), PLAYERS / DRAFT / BOARD /
      TV MODE tabs. Existing mock content renders inside; pause, undo,
      replace-pick, sounds, reveal all preserved.
- [ ] **B2. Player card overlay.** Opens from any player name/cell; ADP /
      PROJ / VOR grid; status strip (available vs. "DRAFTED 2.03 · TEAM").
- [ ] **B3. Pick strip restyle.** Gold borders on the user's picks,
      on-the-clock card, click completed pick → player card.
- [ ] **B4. Players tab.** Reuses A3–A6 components + drafted dimming,
      "3.04 · CB" status text, DRAFT buttons.
- [ ] **B5. My Queue.** Starred players surface as the ordered queue panel;
      auto-drop when drafted; draft/remove from the panel.
- [ ] **B6. Draft tab (Desk).** Three columns (280 / flex / 290): clock panel
  - My Queue + My Roster with real needs (`openNeeds`, includes FLEX/
    SUPERFLEX) on the left, Best Available center, Round strip right.
- [ ] **B7. Board: The Wall.** Restyle `DraftBoardGrid`; arrows 3RR-aware
      (decision 9).
- [ ] **B8. Board: Locker Room.** New roster-first view + Wall/Locker toggle.
- [ ] **B9. TV mode, static.** Header, split-flap board (no motion), latest-
      pick splash, up-next rail; opens as second window via BroadcastChannel.
- [ ] **B10. TV mode, motion.** Flap stagger, 24s ticker, pulses — all behind
      `prefers-reduced-motion`.
- [ ] **B11+. Mobile passes.** One story per tab, layouts from
      `Draft Board Explorations v2 (Dark).dc.html`.

## Backlog (not scheduled)

- Auction format (budgets, $ values, gold price columns thread through the
  whole design once the engine supports it)
- Linear draft format
- Cross-device TV cast (needs a server)
- Bot personalities (e.g., per-bot K/DST gating, blockers)
- Real PROJ/VOR data in the mock pick pool

## Codebase map (verified 2026-06-11)

| Area            | Files                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styles          | `src/index.css` (~2500 lines, `--bg` etc., system-ui today)                                                                                                          |
| Position colors | `src/lib/positionColor.ts` (hex, mirrored as `--pos-*`)                                                                                                              |
| Tiers           | `src/lib/tierBreaks.ts` (user breaks ↔ tier numbers)                                                                                                                 |
| Home board      | `src/components/PlayerTable.tsx`, `TierGroup.tsx`, `PlayerRow.tsx`, `Toolbar.tsx`, `components/board/*` (cells, ColumnManager, RankCell)                             |
| Columns         | `src/lib/columns.ts` (`ColumnId` incl. notes/proj/vor)                                                                                                               |
| Mock UI         | `src/components/mock/` — `MockDraft.tsx` (timer 62–136), `PickPool.tsx` (tier grouping), `PickStrip.tsx`, `DraftBoardGrid.tsx`, `OnTheClockReveal.tsx`, `Avatar.tsx` |
| Mock engine     | `src/lib/mock/` — `engine.ts` (`availableByBoard` = board-order view), `bot.ts` (`specialAllowed` K/DST gate), `order.ts` (snake + 3RR), `roster.ts` (`openNeeds`)   |
| State           | `src/state/reducer.ts`, `useRankings.ts`; persistence in `src/lib/storage.ts` (localStorage)                                                                         |
| Player shape    | `src/types.ts` (`overallRank`, `adp`, `tier`, `flag`, `notes`, `byeWeek`)                                                                                            |

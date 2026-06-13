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

## Plan types & dependencies (planning session, 2026-06-11)

How much planning each story needs, decided with Kenny. Plans are written
**at pickup time** against the codebase as it exists then — never in advance.

- **Direct** — restyle in the story worktree; existing tests stay green; no doc
- **TDD direct** — story has logic: red-green-refactor; no plan doc
- **Light plan** — file map + done-checklist + verification steps; no per-step code
- **Full plan** — complete implementation plan (bite-sized steps, code blocks)

| Story                  | Plan type        | Hard deps        | Why                                                                            |
| ---------------------- | ---------------- | ---------------- | ------------------------------------------------------------------------------ |
| A1 tokens + fonts      | Light plan       | —                | no logic, but every screen shifts                                              |
| A2 header restyle      | Direct           | A1               | CSS-only                                                                       |
| A3 table chrome        | **Full plan**    | A1               | riskiest: drag re-ranking, tier-break editing, column manager must survive     |
| A4 toolbar             | Direct           | A1               | filtering untouched                                                            |
| A5 notes column        | TDD direct       | A3               | icon-when-note, click-opens-popover, edit affordance                           |
| A6 sort toggle         | TDD direct       | A3, A4           | tier↔ADP sort, band hiding, persistence                                        |
| B1 draft-room shell    | Light plan       | A1, A2           | tab state + preservation checklist (pause, undo, replace-pick, sounds, reveal) |
| B2 player card overlay | TDD direct       | A1               | status logic (available vs drafted)                                            |
| B3 pick strip          | Direct           | B1, B2           | styling + click→card                                                           |
| B4 players tab         | Light plan       | A3–A6, B1, B2    | composition; drafted dimming + DRAFT buttons are the logic                     |
| B5 my queue            | TDD direct       | B1               | auto-drop on draft, ordering, draft-from-panel                                 |
| B6 draft tab (Desk)    | **Full plan**    | B1, B2, B5       | three-column composition: clock + queue + `openNeeds` roster + best available  |
| B7 the Wall            | TDD direct       | B1               | arrow derivation from `order.ts` (3RR) is testable logic                       |
| B8 locker room         | Light plan       | B7               | new view + Wall/Locker toggle                                                  |
| B9 TV static           | **Full plan**    | B1               | new surface, BroadcastChannel second window                                    |
| B10 TV motion          | Direct           | B9               | animation behind `prefers-reduced-motion`                                      |
| B11+ mobile            | decide at pickup | each tab's story | one per tab; likely Direct                                                     |

Hard ordering: A1 first → A3 before A5/A6 → B1 gates all of Phase B →
B2 before B3/B4 → B5 before B6 → B7 before B8 → B9 before B10. Everything
else can flex. Parallel-safe pairs if wanted: A2∥A3, B5∥B7.

## Stories

### Phase A — Home page (research board)

- [x] **A1. Design tokens + fonts.** App-global CSS vars for palette, OKLCH
      position key, type scale (README "Design Tokens"); self-host the three
      fonts; swap `positionColor.ts` to the new key. No layout changes — old
      screens just shift hue.
      _Done when: tokens exist, fonts load offline, app structurally unchanged,
      tests green._
- [x] **A2. Header/wordmark restyle.** App bar treatment on home: wordmark
      with orange "Clock.", mono microlabel.
      _Done when: matches spec; existing nav/info links work._
- [x] **A3. Table chrome.** Panel shell, tier bands (orange tick + "TIER N"
      from user tier breaks), row typography, position-hue labels, research
      density. All columns, drag re-ranking, tier-break editing, column manager,
      flags untouched. **Riskiest story** — it touches the board editor's drag
      interactions.
      _Done when: visual match; every current interaction still works._
- [x] **A4. Toolbar restyle.** Search input, position chips, toggles in the
      new language.
      _Done when: visual match; filtering unchanged._
- [x] **A5. Notes column rendering.** Icon when a note exists; click opens
      popover; editable; column show/hide via column manager (already supported).
      _Done when: icon + popover work, notes still editable._
- [x] **A6. Sort toggle.** "Sort by Tier" (default) ↔ "Sort by ADP"; tier
      bands hide in ADP mode; choice persists.
      _Done when: toggle round-trips, default is tier._

### Phase B — Draft room

- [x] **B1. Draft-room shell.** App bar variant: on-the-clock pill (gold when
      it's you), styled timer (current semantics), PLAYERS / DRAFT / BOARD /
      TV MODE tabs. Existing mock content renders inside; pause, undo,
      replace-pick, sounds, reveal all preserved.
      _Thin shell: new `DraftShell` wraps existing `MockDraft`; app bar owns the
      live timer (banner's removed to avoid a double clock), banner otherwise
      untouched. DRAFT tab = working view (banner+roster+pool), PLAYERS = pool,
      BOARD = `DraftBoardGrid`, TV MODE = placeholder (B9 fills it). Carry-forward:
      team shows in both pill + banner on DRAFT (B6 desk resolves it)._
- [x] **B2. Player card overlay.** Opens from any player name/cell; ADP /
      PROJ / VOR grid; status strip (available vs. "DRAFTED 2.03 · TEAM").
      _Pure `playerDraftStatus` helper; VALUE/VOR shows `—` (deferred for mock)._
- [x] **B3. Pick strip restyle.** Gold borders on the user's picks,
      on-the-clock card, click completed pick → player card.
      _Strip click now opens the player card; the edit menu (replace-pick) moved
      to the Board-tab grid click — see B7._
- [x] **B4. Players tab.** Reuses A3–A6 components + drafted dimming,
      "3.04 · CB" status text, DRAFT buttons.
      _Drafted rows dim to 40% with "pick · initials"; DRAFT tab stays
      available-only. Did NOT embed the global PlayerTable. HIDE DRAFTED toggle
      deferred._
- [x] **B5. My Queue.** Starred players surface as the ordered queue panel;
      auto-drop when drafted; draft/remove from the panel.
      _Pure `queue.ts` (`toggleQueue`/`pendingQueue`); ★ on pool rows; panel in
      the DRAFT tab for now (B6 relocates it to the Desk's left column)._
- [x] **B6. Draft tab (Desk).** Three columns (280 / flex / 290): clock panel
  - My Queue + My Roster with real needs (`openNeeds`, includes FLEX/
    SUPERFLEX) on the left, Best Available center, Round strip right.
    _Clock panel reuses `OnTheClockBanner` unchanged (stacked vertically) so
    pause/undo/mute/timer/reveal are preserved; app-bar timer is hidden on the
    DRAFT tab so the Desk owns the live clock (also resolves the B1 pill/banner
    double-team carry-forward). New `MyRoster` + `RoundStrip` components._
- [x] **B7. Board: The Wall.** Restyle `DraftBoardGrid`; arrows 3RR-aware
      (decision 9).
      _Pure `roundDirection(order, teams, round)` derives arrows from the real
      order. Board cell click still opens the edit menu (the preserved
      replace-pick path) — spec's "Wall click → player card" deferred (would
      strand replace-pick until the sim-edit affordance gets a permanent home)._
- [x] **B8. Board: Locker Room.** New roster-first view + Wall/Locker toggle.
      _`LockerRoom` columns + `formatNeeds(openNeeds(...))` footer; read-only._
- [x] **B9. TV mode, static.** Header, split-flap board (no motion), latest-
      pick splash, up-next rail; opens as second window via BroadcastChannel.
      _`buildTvSnapshot(state)` → compact serializable snapshot; `TVStage`
      renders it (shared by the in-app tab + the `#tv` window). Channel
      `"otc-tv"`: main posts on state change + replies to a fresh window's
      request; `main.tsx` mounts `TvWindow` on `#tv`. Read-only/additive._
- [x] **B10. TV mode, motion.** Flap stagger, 24s ticker, pulses — all behind
      `prefers-reduced-motion`.
      _CSS keyframes (otc-flap-in 0.4s/50ms stagger, otc-splash-in spring,
      otc-ticker 24s marquee w/ duplicated track, otc-live-pulse); flap/splash
      replay via React keys on pick-land; reduced-motion zeroes all + scrolls
      the ticker instead of clipping._
- [ ] **B11+. Mobile passes.** One story per tab, layouts from
      `Draft Board Explorations v2 (Dark).dc.html`.

### Phase C — Fidelity pass (surfaces ①–⑨, `redesign-build-spec.md`)

Polish pass closing the "doesn't look stylized" gaps. Shared infra: `.pos-*`
now exposes cascading vars `--c` (badge) / `--c-tint` (row/cell bg) /
`--c-subtext` / `--c-badge-text`, reused by ②⑤⑥③④b. New token `--urgent-red`;
every new keyframe gated behind `prefers-reduced-motion`. One surface per
worktree, ff-merged to local main. ⑨ deferred (ships with live-multiplayer).

- [x] **C1 (①). Position filter chips.** Pill `.filters .chip` (had zero CSS).
- [x] **C2 (②). Pool player rows.** Carded `.pp-row` w/ rank cell, right-side
      orange "DRAFT" button, `team · BYE` meta; position-tint via shared vars.
- [x] **C3 (⑤). Round strip.** `.desk-round-row.done` tint+edge + `desk-cur-pulse`;
      full team names, no more transparent border-left. _CSS-only._
- [x] **C4 (⑥). Locker Room cards.** Column-centered header, gold user-column
      outline, two-line tinted pick cards w/ **full** names + POS·R# subrows.
- [x] **C5 (③). The Wall.** Gold rail arrows, `.bcg-cell.done` real position
      tint, in-cell timer, `.current.is-urgent` red + `bcg-urgent-pulse`.
      _`DraftBoardGrid` gains `urgent` prop; "● ON THE CLOCK" label._
- [x] **C6 (⑦). Player card overlay.** Bordered ✕ CLOSE, rounded nameplate
      meta (`team` / `BYE`), dashed-top stat grid, gold VOR (was VALUE).
- [x] **C7 (⑧). Bottom pick strip.** Top-row abbr, clock-glyph countdown on the
      user's current card, `strip-blink` urgent. _`PickStrip` gains
      `timer`/`urgent` props + `ClockGlyph` SVG._
- [x] **C8 (④a). Home research table.** Default-hide VOR/'25, center PROJ,
      shrink name col, fix truncated headers. _`columnLayout` default hidden._
- [x] **C9 (④b). Mock Players-tab table.** New dense `MockPlayersTable`
      (`★ # PLAYER POS TEAM ADP PROJ BYE STATUS`); replaces `PickPool` in the
      Players tab. STATUS = orange draft button / `pick · team` when drafted.
- [ ] **C10 (⑨). TV stage big-board.** Deferred — builds with live-multiplayer.

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
| Styles          | `src/index.css` (~4600 lines, `--bg` etc., self-hosted fonts)                                                                                                        |
| Position colors | `src/lib/positionColor.ts` (hex, mirrored as `--pos-*`)                                                                                                              |
| Tiers           | `src/lib/tierBreaks.ts` (user breaks ↔ tier numbers)                                                                                                                 |
| Home board      | `src/components/PlayerTable.tsx`, `TierGroup.tsx`, `PlayerRow.tsx`, `Toolbar.tsx`, `components/board/*` (cells, ColumnManager, RankCell)                             |
| Columns         | `src/lib/columns.ts` (`ColumnId` incl. notes/proj/vor)                                                                                                               |
| Mock UI         | `src/components/mock/` — `MockDraft.tsx` (timer 62–136), `PickPool.tsx` (tier grouping), `PickStrip.tsx`, `DraftBoardGrid.tsx`, `OnTheClockReveal.tsx`, `Avatar.tsx` |
| Mock engine     | `src/lib/mock/` — `engine.ts` (`availableByBoard` = board-order view), `bot.ts` (`specialAllowed` K/DST gate), `order.ts` (snake + 3RR), `roster.ts` (`openNeeds`)   |
| State           | `src/state/reducer.ts`, `useRankings.ts`; persistence in `src/lib/storage.ts` (localStorage)                                                                         |
| Player shape    | `src/types.ts` (`overallRank`, `adp`, `tier`, `flag`, `notes`, `byeWeek`)                                                                                            |

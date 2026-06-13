# On The Clock — Redesign Build Handoff (Surfaces ①–⑨)

**For:** the implementing agent.
**Repo:** `~/Developer/on-the-clock` (Vite + React 19 + TS; single big `src/index.css`; vitest).
**Status:** A surface-by-surface fidelity audit against the design prototype is **complete — all 9 surfaces decided** with Kenny. **Nothing is implemented yet.** This doc is the build spec.

## Sources of truth

- Design prototype (visual reference, **not** code to copy): `docs/design/draft-room/Draft Room v3 (Unified).dc.html` (inline styles = exact values) + spec `docs/design/draft-room/README.md`.
- Original story handoff + decisions: `docs/redesign/handoff.md` (read its "Decisions" section — still in force).
- Every exact value the agent needs is inline below; you do **not** need the audit's throwaway HTML mockups.

## Workflow & constraints (hard)

- Work **one surface per branch/worktree**, TDD where there's logic, run `npx vitest run` + `npx tsc --noEmit` + `npm run build`, then fast-forward merge to **local `main`**.
- **DO NOT push to remote.** Main is local-only. Commits: short imperative, **no Co-Author trailer**.
- **No feature loss** — every existing control survives, restyled (pause/undo/replace-pick/columns/notes/avoid/sounds/reveal/drag).
- ①–⑧ are buildable now. **⑨ (TV) ships only with the future live-multiplayer draft** — build last / defer.

---

## Global rules (apply to ALL surfaces)

**Player names:** always show the **full** player name (e.g. "Bijan Robinson"), never abbreviate — _except_ the TV flap board (⑨), which uses initial+last by design. Truncate with ellipsis only when a column is genuinely too narrow.

**Team labels:** always the **abbreviation** (ATL / LAR / LAC / NYJ / NYG). No city/nickname. No abbr→name map needed.

**Fonts (role-locked, self-hosted — already wired in `main.tsx`):**

- **Archivo** 700–800 → headlines, team names, timers, wordmark, player-card name, big numbers.
- **Barlow Condensed** 400–700 → player names, buttons, tabs, chips, labels (uppercase, ls 1–2px).
- **IBM Plex Mono** 400–700 → ALL numbers & metadata (ADP, pick #s, bylines, microlabels). Microlabels 9–11px, ls 1.5–3px, uppercase.

**Buttons / pills must be consistent app-wide:**

- DRAFT button: `bg #FB5A2D; color #fff; border:none; border-radius:5px; padding:5px 12px; Barlow Condensed 700; font-size:11px; letter-spacing:1.5px`.
- Filter chip pill: `border-radius:999px; Barlow Condensed 700; 12px; ls 1px`; active = `bg #FB5A2D / #fff / border #FB5A2D`; inactive = `transparent / #9AA3AE / border #2A323D`.

**Design tokens (already in `:root` of `src/index.css`):** `--void #0b0e13` · `--stage #07090c` (TV) · `--raised #0e1218` · `--panel-2 #12161d` · `--card #161b23` · `--card-high #1a2029` · borders `#1c232c/#222933/#242c37/#2a323d/#39424f` · `--text-primary #eceef1` · `--text-secondary #9aa3ae` · `--text-tertiary #707a87` / `#5c6470` / `--text-disabled #3e4650` · `--clock-orange #fb5a2d` · `--live-green #2fc76d` · `--your-gold #d9a53f` · urgent red `#ef4444` (add if missing).

**Position key (OKLCH, in `src/lib/positionColor.ts` / `--pos-*`):** badge `oklch(0.62 0.14 H)` (TE `0.66 0.13 75`), tint `oklch(0.26 0.04 H)` (TE `0.27 0.05 75`), subtext `oklch(0.72 0.06 H)` (TE `0.74 0.07 75`). H: QB 30 · RB 150 · WR 250 · TE 75 · K 310 · DST 200. Badge text white, **TE badge text `#1A1407`**.

---

## ① Position filter chips — _fidelity miss_

**Where:** the mock-draft pool filter bar — `src/components/mock/MockDraft.tsx` `filterBar` renders `<button className="chip">` inside `.filters`. **There is no CSS for `.filters .chip`** today (renders as a UA-default button — the bug).
**Do:** add CSS so `.filters .chip` matches the pill spec above (`.toolbar .chip` on the home page already does this — mirror it). Active = orange fill; inactive = transparent/`#9AA3AE`/border `#2A323D`. **Bigger tap target** for mobile: `padding:6px 14px; font-size:12.5px`.
**Keep:** the **K** and **DST** chips (prototype omits them; we keep — they're our positions). Render them slightly dimmer when not the focus is optional.
**Done when:** chips are pills, active turns orange, K/DST present.

## ② Best Available / pool player rows — _fidelity miss_

**Where:** `src/components/mock/PickPool.tsx` (rows `.pp-row`, badge `.pp-pos`, name `.pp-name`, draft `.pp-draft`, star `.pp-star`).
**Do (row → carded):** `.pp-row { background:#1A2029; border:1px solid #242C37; border-radius:7px; padding:8px 10px; gap:9px }` (rows gap ~6px in the list). Add a **rank** cell at the start (mono 11px `#707A87`, width 24, right-aligned). Position badge solid 34px (`border-radius:3; 700; 10px; ls 1px; pos bg; white text / TE #1A1407`). Name 600 **15px**, full, clickable → card. Meta: `TEAM · BYE n` mono 10px `#707A87`; ADP mono 10px `#9AA3AE`.
**Move the draft control:** today it's a green **`+`** on the **left**. Replace with the **right-aligned orange DRAFT text button** (global button spec). Drafted rows: dim ~40% and show `pick · TEAM` where the button was.
**Keep:** ★ star-to-queue, avoid (⊘) flag, notes (📝), the drafted state.
**Done when:** rows are cards with a 34px badge and a right orange DRAFT button; full names; star/flags/notes intact.

## ③ Board — The Wall — _mostly there; small adopts + new timer_

**Where:** `src/components/mock/DraftBoardGrid.tsx` (`.wall-rail-arrow`, `.wall-rail-round`, `.bcg-cell`, `.bcg-cell.current`, `.bcg-cell.done`).
**Do:**

- Rail **arrows → gold** `#D9A53F` (currently grey `#5c6470`). Round numbers → mono **700 12px** (currently 9px dim).
- Done cells: use the **full position tint** `oklch(0.26 0.04 H)` as bg (currently a weak `color-mix` 18%); keep the 4px pos-color left border + light-tint subtext.
- **NEW — countdown in the on-the-clock cell:** the current cell shows green `● ON THE CLOCK` **and a centered countdown timer** (Archivo 800 ~19px). At **≤5s**: timer text → **red `#ef4444`**, the cell's dashed outline → red, and a faster pulse. Pull the time from the existing pick clock (`MockDraft.tsx` `remaining`/`timerUi`); pass into `DraftBoardGrid`.
  **Keep:** full names; 3RR-correct arrows (already derived from real order); click filled cell → Replace/Resume-from-here menu; the existing current-cell pulse.
  **Done when:** gold arrows, fuller tint, and the current cell shows a centered timer that goes red+pulses at ≤5s.

## ④ Tables — home research table + mock Players tab

**(a) Home research table** (`src/components/PlayerTable.tsx`, `table.players`):

- Keep the confined panel + **keep the zebra striping**. Headers stay mono microlabels.
- **Center** the POS / TEAM / ADP / PROJ / BYE columns _and their headers_ (today POS/TEAM are left-aligned while numbers are right-aligned → uneven gap). Uniform centered rhythm.
- **Shrink the PLAYER column** (leave room for a future click-to-open player **sidebar**).
- Make **VOR, '25 and other extra columns default OFF** (configurable via the existing `⚙ Columns` manager — set default visibility in `src/lib/columns.ts`). Keep them available.
- Fix the truncated header labels ("DRAF\_", "\*/⊘") → real labels.
- **Keep** drag-to-rerank, the drafted toggle column, and notes.
  **(b) Mock-draft Players tab** — make it a **dense table** (the prototype's Players-tab look), distinct from the home table and from the Best Available list:
- Columns: `★ · # · PLAYER · POS · TEAM · ADP · PROJ · BYE · STATUS`.
- `★` adds to queue. **No** drag, **no** drafted toggle, **no** avoid.
- `STATUS` = the orange **DRAFT** button (available) or `pick · TEAM` dimmed (taken).
- (Implementation note: today the mock Players tab reuses the PickPool list; this is the one structural lift — render a table for it.)
  **Notes UX (already built in A5 — keep):** ✎ icon is **dim when empty, gold when a note exists**; **click** opens a small popover with a textarea (add + read + edit in one); closes on **Esc** / click-outside; autosaves; no hover.
  **Done when:** home table columns are centered with zebra + shrunk name + extras off-by-default; mock Players tab is the dense star/STATUS table.

## ⑤ Round strip (Draft tab right rail) — _fidelity miss_

**Where:** `src/components/mock/RoundStrip.tsx` (`.desk-round-row`, `.drow-*`).
**Do:** done rows get a **position-tint bg + 3px pos-color left border** (today the left border is `transparent` — the bug). Team abbr → **700 10.5px**. Add a `tap for card` hint in the header. Current row keeps the gold dashed treatment **+ pulse** (match ③). Full names. Click row → player card.
**Done when:** completed rows are position-tinted with a colored edge; current row pulses.

## ⑥ Locker Room cards — _two adopts_

**Where:** `src/components/mock/LockerRoom.tsx` (`.lr-header`, `.lr-pick-card`, `.lr-needs`).
**Do:**

- **Header → centered card:** avatar on **top**, team name centered below (bg `#161B23`, border `#242C37`, radius 8, padding `10px 4px`), instead of the current horizontal (avatar beside name).
- **Pick cards → position-tinted, two-line:** bg = pos tint, 3px pos-color left border, radius 4; **name on top** (600 12px, full), **sub-row below** = `POS` (left) · `R#` (right) in the position's subtext color. (Today: single line + a grey badge, no tint.)
  **Keep:** gold outline on the user's column header; needs footer (dashed top); click card → player card / edit menu.
  **Done when:** centered header cards + tinted two-line pick cards.

## ⑦ Player card overlay — _polish + nameplate change_

**Where:** `src/components/mock/PlayerPanel.tsx` (`.pc-*`). Structure already matches the prototype.
**Do:**

- **✕ CLOSE → bordered button:** `border:1px solid #39424F; border-radius:5px; padding:3px 9px; Barlow 700 11px; color:#9AA3AE`.
- **Nameplate → rounded dark plate** (`bg #0B0E13; border-radius:5; padding:10px 12px`) and **move the meta line INSIDE it, under the name**.
- **Drop the position from the meta** (the badge already shows it). Inside the plate, under the name: **team abbr (left) · bye (right, small/dim mono)** — e.g. `ATL` … `BYE 11`.
- **Stat grid → clean:** dashed top rule `#2A323D`, **no internal divider lines** (today has them). Labels mono 9px ls2 `#707A87`; values 700 16px; the gold stat is **VOR** (auction's deferred — the first stat is **ADP**, and swaps to **VALUE ($)** only in auction mode).
- Airier inner frame: padding 14, gap 10.
  **Keep:** 3px position-color frame; Esc + scrim close; drafted status strip (position-tinted, `DRAFTED x.xx · TEAM`) vs green `✓ STILL AVAILABLE`.
  **Done when:** bordered close, rounded plate with team/bye inside (no position), clean dashed-top stat grid, VOR gold.

## ⑧ Bottom pick strip — _layout + clock indicator_

**Where:** `src/components/mock/PickStrip.tsx` (`.mock-strip .strip-*`). Cards are 118px, radius 7, padding `7px 9px`.
**Do:**

- **Top row of every card:** pick # (left; **gold** if it's the local user's pick) + **team abbr** (right) in mono 9px. Player **name** (full, 600 12.5px) on the line below.
- Done cards: position-tint bg. User's picks: gold pick # + gold-tinted border `rgba(217,165,63,0.45)`.
- **Current "on the clock" card → clock icon + countdown** _replacing the "ON THE CLOCK" words_: a small **clock glyph** (SVG: `<circle r=9>` + hand `M12 7.5V12l3 2`) + the **countdown timer** (mono 700). **Static** normally (gold). At **≤5s**: clock + timer → **red `#ef4444`**, **blink** (≈1s opacity pulse), and the card border flips red.
  **Keep:** the reach/value **signal dot** (green = value) we show on picks; click card → player card.
  **Done when:** every card shows pick#+abbr / name; current card shows the clock-icon+countdown, red+blinking only at ≤5s.

## ⑨ TV stage — party big-board _(build LAST; ships with live-multiplayer)_

A bigger redesign of `src/components/mock/TVStage.tsx` (+ extend `src/lib/mock/tvSnapshot.ts`). It is the **spectator screen for the future live multiplayer draft**, where every team is real people on a clock (so the big clock is **always live** — not the single-player "your turn only" clock).

**Header:** left = `● LIVE` + `ROUND n · PICK x OF y` + a thin **orange round-progress bar**. Center = on-clock team (avatar + name, big). Right = **big always-on clock** (Archivo 800 ~70px); **red `#ef4444` at ≤5s**.
**"PICK IS IN" reveal:** when a pick lands, the **clock area flips to "PICK IS IN"** for a beat (~1s delay), then the name **flips in letter-by-letter** (split-flap; this is the existing B10 flap animation made sequential). Sounds already exist — fire on reveal.
**Board = continuous feed across rounds** (not round-reset): the on-clock pick sits **~5–6 rows down**. Window = **max 5 done above / current / max 3 upcoming below**. Upcoming rows show **empty (dim) tiles + the faint full team name**. Names **persist the whole draft**.
**Flap tiles:** **fixed 20-wide**. Name = **first initial · space · last name** for every player (**no dot**; the space is a real gap tile; **keep hyphens** — e.g. `K Williams`, `J Smith-Njigba`, `M Valdes-Scantling`). Longest skill surname lands at 18 chars → 2 spare. Position badge after the tiles.
**Right column (dense — cards are small):**

1. **LATEST PICK** celebration — `LATEST PICK · x.xx` label + a **STEAL/REACH** badge (from our reach/value signal, e.g. `STEAL · +14 ADP`), player name big (Archivo 800 ~30px), pos badge, `TEAM · BYE`, `by <team>` in gold.
2. **ON THE CLOCK · ROSTER (by position)** — a **depth-chart**: rows `QB / RB / WR / TE / FLEX`, each with that team's picks as small position-tinted chips; a gold **NEEDS** line below. (Chosen over a chronological block.)
3. **STILL ON THE BOARD** — top **6** available, **with ADP** (pos badge + name + ADP).
   **Dropped:** the separate Up-Next panel and the bottom ticker (the cross-round feed covers both).
   **Snapshot work (`tvSnapshot.ts`):** extend `buildTvSnapshot` to provide: the windowed cross-round feed (5/current/3) with per-row state + team name for upcoming; the on-clock team's roster grouped by position + needs; top-6 still-on-board with ADP; latest-pick steal/reach flag; a transient "pick is in" flag for the reveal. Keep it serializable for the BroadcastChannel mirror.
   **Respect `prefers-reduced-motion`** (no flap/blink/marquee; static).
   **Backlog (do NOT build now):** end-of-round **draft superlatives** ("biggest steal so far").

---

## Suggested order

①+②+⑤+⑥ (shared "position-tint + carded" language; quick wins) → ③ (timer) → ⑦ → ⑧ → ④ (the mock Players-tab table is the only structural lift) → ⑨ (last, with live-multiplayer).

## Acceptance (every surface)

`npx vitest run` green · `npx tsc --noEmit` clean · `npm run build` clean · console error-free · no feature lost · matches the spec values above. Verify visually from `npm run dev` (fonts load from localhost).

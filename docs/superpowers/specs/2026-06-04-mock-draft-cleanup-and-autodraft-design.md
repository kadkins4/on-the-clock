# Mock draft — cleanup pass + auto-draft — design

Date: 2026-06-04
Branch: `mock-draft-redesign`
Iterates on: `2026-06-04-mock-draft-visual-overhaul-design.md` (from live testing feedback)

## Goal

Tighten the just-built mock draft: it feels cramped and has redundant chrome.
Plus two functional adds (auto-draft, 30s default clock). Approved via the
`draft-cleanup.html` mockup.

## Part A — Layout cleanup

1. **One clock, team centered (remove the duplicate).** Delete the separate
   `.otc-clockcard` (added in the overhaul). In `OnTheClockBanner`, show the team
   currently on the clock **centered** in the main row: `[avatar+ring] ON THE
CLOCK · <team name> · <pick label>` (reads `state.teams[currentTeamIndex]`).
   Keep the banner's single existing timer (shown on the user's turn) and the
   `R · Pick N of M` line. No second timer anywhere.

2. **One tab bar incl. the board; rename to avoid confusion.** Remove the
   standalone "Draft board" toggle button and the sliding sheet behavior. The
   pool tabs become **Players · Queue · Draft Board**:
   - **Players** = the pick pool (renamed from "Board" — "Board" collided with
     "Draft board" and misled the user).
   - **Queue** = the coming-soon shell (unchanged).
   - **Draft Board** = the board grid, rendered **inline as tab content** (not a
     separate overlay sheet). `DraftBoardGrid` becomes a normal in-flow panel.

3. **Roomier filters.** The position chips and the columns control get breathing
   room; the columns control moves to the **right** of the chip row as a compact
   **⚙ Columns** control (instead of the inline `Bye/Proj/VOR` pills jammed under
   the chips). Cap of 3 optional columns still applies.

4. **Draft ＋ on the far left.** In each `PickPool` row the green **＋** draft
   button is the **first** element (left edge), so it's the first thing the
   cursor reaches. It becomes a solid green square button.

5. **Red tier banners + bolder position pills.** Tier banners use the
   draft-helper accent `--otc-accent` (`#ff6b4a`), left+right border like the
   main board's tier dividers. Position pills get bolder weight/contrast so
   RB/WR/TE/QB read instantly.

6. **Consistent round labels (never bare overall numbers).** Every pick display
   — board cells, `PickStrip`, and the post-draft views — shows the round.pick
   label (e.g. `1.04`) plus a small round indicator ("round dot"), matching the
   bottom cards. Audit `PickStrip` and `MockSummary` and fix any place that shows
   only the overall pick number.

7. **Pick clock defaults to 30s.** Change the default `timerSec`/`remaining`
   from 60 to 30. (The timer _selector_ redesign — a header dropdown and a new
   20s option — is **deferred** by user request; keep the existing cog menu.)

## Part B — Auto-draft

8. **Setup toggle: "Auto-draft my picks."** A checkbox in `MockSetup` (stored on
   `MockSettings` as `autoDraft: boolean`, default false). When on, the user's
   turns auto-pick the best available (`bestAvailableId`) after a short beat,
   like a bot.

9. **Missed-pick popup.** When the user's clock hits 0 **and** auto-draft is off,
   that pick still auto-picks the best available (current behavior), AND a modal
   appears: **"You missed your pick — Keep drafting / Auto-draft the rest."**
   - The modal has its own ~25s countdown.
   - **Keep drafting** → dismiss; the user continues manually.
   - **Auto-draft the rest** (or the countdown expiring with no choice) → turn
     auto-draft on so the draft finishes itself.
   - The modal shows once per draft (a `promptedMissedPick` flag), so it doesn't
     nag every missed pick.

## Architecture notes

- `MockSettings` gains `autoDraft?: boolean`. The auto-pick trigger lives in
  `MockDraft`'s existing timer/turn effects: when it's the user's live turn and
  `autoDraft` is on (or after the miss flow turns it on), schedule
  `onDraft(bestAvailableId(state))` on a short delay (mirroring the bot tick).
- Pure-ish helper worth a test: a small function deciding the auto-pick id for
  the user's turn (reuses `bestAvailableId`); the popup/countdown is UI.
- The single-clock change is contained to `OnTheClockBanner` (+ removing the
  `.otc-clockcard` JSX/CSS). The tab/board change is in `MockDraft` +
  `DraftBoardGrid` (drop the sheet wrapper). Filters/rows/tiers are CSS +
  `PickPool` row reorder.

## Testing

- Unit: `autoDraft` default in `createMock`/settings; the auto-pick helper
  returns `bestAvailableId`. Existing mock tests stay green.
- Manual (in-app): one clock with centered team; Players/Queue/Draft Board tabs
  (Draft Board inline); roomy filters with ⚙ Columns; ＋ on the left; red tiers;
  bold positions; round.pick labels everywhere; 30s default; auto-draft toggle
  drafts your turns; missed-pick popup appears, counts down, and auto-finishes.

## Out of scope / deferred

- Header timer **dropdown** + the **20s** option (revisit later).
- Queue functionality (still coming-soon).
- Real player-info content in the slide panel.

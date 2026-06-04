# Mock Draft Cleanup + Auto-draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-clutter the mock draft (single clock, unified tabs, roomier filters, left-aligned draft button, red tiers, consistent round labels) and add auto-draft + a missed-pick popup; default the clock to 30s.

**Architecture:** Mostly presentation changes to existing mock components; one settings flag (`autoDraft`) and a missed-pick modal add behavior. No new pure modules except a tiny auto-pick helper. Dark theme only.

**Tech Stack:** React 19 + TS, Vitest 4, Vite, `src/index.css`.

**Spec:** `docs/superpowers/specs/2026-06-04-mock-draft-cleanup-and-autodraft-design.md`

---

## Conventions

- `npx tsc --noEmit` clean + `npx vitest run` green after each task; commit per task with the co-author trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- Visual tasks end in a manual-verification note (controller checks in-browser).

---

# Part A — Layout cleanup

## Task A1: Single clock — centered on-the-clock team; remove the duplicate card

**Files:** `src/components/mock/OnTheClockBanner.tsx`, `src/components/mock/MockDraft.tsx`, `src/index.css`

- [ ] **Step 1: Remove the duplicate clock card.** In `MockDraft.tsx`, delete the entire `<div className="otc-clockcard">…</div>` block (added previously, just below `<OnTheClockBanner …/>`). Remove the now-unused `Avatar` import from `MockDraft` only if nothing else there uses it (the board grid imports its own).

- [ ] **Step 2: Add the centered team to the banner.** In `OnTheClockBanner.tsx`, compute the on-the-clock team and render it centered in `.mock-banner-main`, between `.otc-banner-status` and `.mock-banner-right`:

```tsx
import { Avatar } from "./Avatar";
import { currentTeamIndex } from "../../lib/mock/engine";
import { formatPick } from "../../lib/mock/board";
// inside component, before return:
const onClock = currentTeamIndex(state);
const team = state.teams[onClock];
```

Insert between the status and right blocks:

```tsx
{
  !isComplete && team && (
    <div className="otc-banner-team">
      <Avatar
        initials={team.initials}
        color={team.color}
        size={30}
        ring={isUser}
      />
      <div className="obt-who">
        <div className="obt-lbl">On the clock</div>
        <div className="obt-name">
          {team.name}{" "}
          <span className="obt-pick">
            · {formatPick(overall, state.settings.teams)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: CSS.** Make `.mock-banner-main` a 3-part flex row (status left, team center, right right) and style the team block:

```css
.otc-banner-team {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
}
.obt-lbl {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #34d399;
}
.obt-name {
  font-weight: 800;
  font-size: 15px;
}
.obt-pick {
  font-size: 11px;
  color: #8b93a4;
  font-weight: 600;
}
```

Delete the `.otc-clockcard`/`.occ-*` rules.

- [ ] **Step 4:** `npx tsc --noEmit` clean, `npx vitest run` green. Manual: one clock; the on-the-clock team (avatar+name+pick) is centered in the header; the timer still appears on your turn. **Commit:** `Consolidate the mock header into a single clock with the team centered`.

## Task A2: Unified tabs (Players · Queue · Draft Board); board inline

**Files:** `src/components/mock/MockDraft.tsx`, `src/components/mock/DraftBoardGrid.tsx`, `src/index.css`

- [ ] **Step 1: Tab model.** In `MockDraft.tsx`, change `poolTab` to `"players" | "queue" | "board"` (default `"players"`). Remove the `.mock-boardtoggle` button and the `boardOpen` state. Render the tab bar:

```tsx
<div className="pool-tabs">
  <button
    className={poolTab === "players" ? "on" : ""}
    onClick={() => setPoolTab("players")}
  >
    Players
  </button>
  <button
    className={poolTab === "queue" ? "on" : ""}
    onClick={() => setPoolTab("queue")}
  >
    Queue
  </button>
  <button
    className={poolTab === "board" ? "on" : ""}
    onClick={() => setPoolTab("board")}
  >
    Draft Board
  </button>
</div>
```

Render the chips + `PickPool` only when `poolTab === "players"`; the queue-soon block when `"queue"`; and `<DraftBoardGrid …/>` when `"board"`.

- [ ] **Step 2: Board becomes inline.** In `DraftBoardGrid.tsx`, drop the sheet wrapper: remove the `mock-board-sheet`/`open`/`onClose` props and the `board-peek` + `board-head`/Close markup; render just the `board-cardgrid` (team header + rows) inside a plain `<div className="board-inline">`. Update `MockDraft`'s usage to pass only `state`, `onPickClick`, and `timer` (drop `open`/`onClose`/`canDraft`/`onDraft` — drafting happens from the Players tab now). Keep the existing on-the-clock/upcoming/done cell rendering.

- [ ] **Step 3: CSS.** Remove `.mock-board-sheet`, `.board-peek`, `.board-head` styling usage if now-orphaned (leave shared rules used elsewhere). Add `.board-inline { padding: 8px 0; overflow-x: auto; }`.

- [ ] **Step 4:** tsc clean, suite green. Manual: three tabs; "Draft Board" shows the grid inline in the same panel; no separate sheet; no more standalone "Draft board" button. **Commit:** `Fold the draft board into a Players/Queue/Draft Board tab bar`.

## Task A3: Roomier filters + ⚙ Columns control

**Files:** `src/components/mock/MockDraft.tsx`, `src/components/mock/PickPool.tsx`, `src/index.css`

- [ ] **Step 1:** Put the position chips and a single **⚙ Columns** control on one padded row (chips left, columns control pushed right with `margin-left:auto`). Replace the inline `Bye/Proj/VOR` pill bar with a small popover opened by the ⚙ Columns button (same capped toggles inside). Keep `extraCols`/`POOL_COL_CAP` logic.

- [ ] **Step 2: CSS.** `.filters { display:flex; align-items:center; gap:8px; padding:12px 12px 10px; flex-wrap:wrap; }` `.colbtn { margin-left:auto; … }` `.colmenu { … popover … }`. Give the chip row and tier banner clear vertical separation.

- [ ] **Step 3:** tsc clean, suite green. Manual: filters have breathing room; ⚙ Columns opens the bye/proj/vor toggles (proj/vor still disabled). **Commit:** `Give pool filters room; move columns into a ⚙ Columns control`.

## Task A4: Draft ＋ on the left; red tiers; bolder position pills

**Files:** `src/components/mock/PickPool.tsx`, `src/index.css`

- [ ] **Step 1:** In `PickPool` rows, move the `＋` draft button to be the **first** child (before the position pill). Restyle to a solid green square.

- [ ] **Step 2: CSS.** Tier banner red:

```css
.pp-tier {
  background: #1a1411;
  border-left: 3px solid var(--otc-accent);
  border-right: 3px solid var(--otc-accent);
  color: #ffd9cf;
}
.pp-cnt {
  color: #b08778;
}
.pp-draft {
  order: -1;
  width: 30px;
  height: 30px;
  border: none;
  background: #16a34a;
  color: #fff;
  border-radius: 8px;
  font-size: 18px;
  box-shadow: 0 1px 0 #0d6b32;
}
.pp-draft:hover {
  background: #15b150;
}
.pp-pos {
  font-weight: 900;
}
```

(Putting `＋` first in the JSX is cleaner than `order`, but either works; prefer JSX order.)

- [ ] **Step 3:** tsc clean, suite green. Manual: ＋ is the leftmost control on each row; tiers are red; RB/WR/TE/QB pills read instantly. **Commit:** `Move draft button left; red tier banners; bolder position pills`.

## Task A5: Consistent round labels (no bare overall numbers)

**Files:** `src/components/mock/PickStrip.tsx`, `src/components/mock/MockSummary.tsx` (audit), `src/index.css`

- [ ] **Step 1:** READ `PickStrip.tsx` and `MockSummary.tsx`. Anywhere a pick is shown by bare overall number, switch to `formatPick(overall, teams)` (round.pick, e.g. `1.04`) and add a small round indicator (a "round dot": a tiny circle with the round number, or the `R{round}` prefix) consistent with the bottom cards. Use `formatPick` from `../../lib/mock/board`.

- [ ] **Step 2:** tsc clean, suite green. Manual: open the Draft Board tab and the bottom strip mid- and end-draft — every cell shows the round.pick label + round indicator, never just an overall number. **Commit:** `Show round.pick labels consistently across board and strip`.

## Task A6: Default the pick clock to 30s

**Files:** `src/components/mock/MockDraft.tsx`

- [ ] **Step 1:** Change the timer defaults from 60 to 30: `useState<number | null>(30)` for `timerSec` and `useState(30)` for `remaining`.

- [ ] **Step 2:** tsc clean, suite green. Manual: a fresh mock starts the user clock at 0:30. **Commit:** `Default the pick clock to 30 seconds`.

---

# Part B — Auto-draft

## Task B1: `autoDraft` setting + plumb through

**Files:** `src/lib/mock/types.ts`, `src/components/mock/MockSetup.tsx`, `src/components/mock/MockMode.tsx`, `src/lib/mock/engine.test.ts`

- [ ] **Step 1:** Add `autoDraft?: boolean` to `MockSettings` in `src/lib/mock/types.ts`.

- [ ] **Step 2:** In `MockSetup.tsx`, add a checkbox "Auto-draft my picks" bound into the `settings` passed to `onStart` (default false). Follow the existing control pattern in that file.

- [ ] **Step 3 (test):** In `engine.test.ts`, assert `createMock(..., { …, autoDraft: true }).settings.autoDraft === true` (settings is carried through). Run `npx vitest run src/lib/mock/engine.test.ts` — pass.

- [ ] **Step 4:** tsc clean, suite green. **Commit:** `Add auto-draft setting to mock settings and setup`.

## Task B2: Auto-pick the user's turn when auto-draft is on

**Files:** `src/components/mock/MockDraft.tsx`

- [ ] **Step 1:** Add an effect: when it is the user's live, unpaused, non-revealing turn AND auto-draft is active (`state.settings.autoDraft` OR a local `autoOn` state set by the popup), schedule `onDraft(bestAvailableId(state))` after ~`BOT_DELAY`ms (reuse the constant). Guard against double-firing (same as the bot effect). Keep the existing countdown effect (it still runs but the auto-pick fires first when auto is on).

- [ ] **Step 2:** tsc clean, suite green. Manual: enable auto-draft in setup; your turns pick the best available automatically and the draft completes. **Commit:** `Auto-draft the user's picks when enabled`.

## Task B3: Missed-pick popup

**Files:** `src/components/mock/MockDraft.tsx`, `src/index.css`

- [ ] **Step 1: State.** Add `const [autoOn, setAutoOn] = useState(!!state.settings.autoDraft);` and `const [missed, setMissed] = useState(false);` and a `promptedRef = useRef(false)`.

- [ ] **Step 2: Trigger.** In the countdown effect, when `remaining <= 0` on the user's turn and `!autoOn` and `!promptedRef.current`: set `promptedRef.current = true`, `setMissed(true)` (still auto-pick this pick via the existing `onDraft(bestAvailableId)` so the draft proceeds).

- [ ] **Step 3: Modal + countdown.** Render when `missed`:

```tsx
{
  missed && (
    <div className="missed-scrim">
      <div className="missed-modal">
        <h3>⏰ You missed your pick</h3>
        <p>
          Your clock ran out. Keep drafting, or let auto-draft finish for you?
        </p>
        <div className="missed-acts">
          <button className="ghost" onClick={() => setMissed(false)}>
            Keep drafting
          </button>
          <button
            className="primary"
            onClick={() => {
              setAutoOn(true);
              setMissed(false);
            }}
          >
            Auto-draft the rest
          </button>
        </div>
        <div className="missed-count">
          Auto-drafts in {missedLeft}s if you don't choose…
        </div>
      </div>
    </div>
  );
}
```

Add a `missedLeft` countdown (`useState(25)` + an effect that decrements while `missed` and on 0 does `setAutoOn(true); setMissed(false)`).

- [ ] **Step 4: CSS** for `.missed-scrim`/`.missed-modal`/buttons/count (centered modal, dark card; reuse the slide-panel button styles where handy).

- [ ] **Step 5:** tsc clean, suite green. Manual: with auto-draft OFF and a 30s clock, let your pick expire → the modal appears; "Auto-draft the rest" (or the countdown) finishes the draft; "Keep drafting" dismisses and it doesn't nag again. **Commit:** `Add missed-pick popup that offers to auto-draft the rest`.

---

## Task C: Final verification

- [ ] `npx vitest run && npx tsc --noEmit && npm run build` — all green.
- [ ] Full in-app walkthrough of every Part A + B item. Report results.

---

## Self-Review (plan author)

- **Spec coverage:** single clock/centered team (A1) · unified tabs + inline board + rename (A2) · roomy filters + ⚙ Columns (A3) · draft-left + red tiers + bold pills (A4) · round labels everywhere (A5) · 30s default (A6) · autoDraft setting (B1) · auto-pick (B2) · missed-pick popup (B3). All spec items mapped. Deferred items (timer dropdown, 20s) intentionally excluded.
- **Type consistency:** `poolTab` values, `MockSettings.autoDraft`, `formatPick`, `Avatar`, `currentTeamIndex`, `bestAvailableId` all match existing exports.
- **Executor notes:** A2 makes the board inline — verify nothing else depends on the `mock-board-sheet` open/close. A5 requires reading `PickStrip`/`MockSummary` first to find bare-overall displays.

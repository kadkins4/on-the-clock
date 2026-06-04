# Mock Draft Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the table-y mock draft into a cohesive dark, card-based draft room — position-colored cards, team identity, on-the-clock timer card, a tier-list-aware pick pool, and a player slide panel — built in phases, board first.

**Architecture:** Two small tested foundation modules (position colors + generated team identity) feed a set of presentational components. Team identity is generated at draft start and stored on `MockState`. Everything else reuses the existing mock engine unchanged; the work is presentation. Dark theme only, behind a thin seam so skins can come later.

**Tech Stack:** React 19 + TypeScript, Vitest 4 + @testing-library/react, Vite, CSS (`src/index.css`).

**Spec:** `docs/superpowers/specs/2026-06-04-mock-draft-visual-overhaul-design.md`

---

## Conventions

- Run one test file: `npx vitest run <path>`
- Whole suite: `npx vitest run` · Typecheck: `npx tsc --noEmit`
- Dev server for manual checks: `npm run dev` → open the app → ⚙ menu → "🏈 Mock draft…" → Start mock.
- Commit trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- **Visual tasks** end in a **manual verification** step (the gate), since CSS is iterative and not unit-testable. Logic/data tasks are TDD.

---

## File Structure

- **Create** `src/lib/positionColor.ts` — canonical `Position → color` map (+ helper). Single source of truth.
- **Create** `src/lib/positionColor.test.ts`
- **Create** `src/lib/mock/teamIdentity.ts` — pure, seeded generator of `TeamIdentity[]`.
- **Create** `src/lib/mock/teamIdentity.test.ts`
- **Modify** `src/lib/mock/types.ts` — add `teams: TeamIdentity[]` to `MockState`.
- **Modify** `src/lib/mock/engine.ts` — populate `teams` in `createMock`.
- **Create** `src/components/mock/Avatar.tsx` — initials-in-colored-circle.
- **Create** `src/components/mock/PlayerPanel.tsx` — slide-over (coming soon).
- **Create** `src/components/mock/PickPool.tsx` — the tier-list-aware pool (extracted from `MockDraft`).
- **Modify** `src/components/mock/DraftBoardGrid.tsx` — card grid + team header.
- **Modify** `src/components/mock/MockDraft.tsx` — use `PickPool`, `PlayerPanel`; pass team identity.
- **Modify** `src/components/mock/MockSetup.tsx`, `MockSummary.tsx` — dark reskin + setup customization.
- **Modify** `src/index.css` — position color custom properties + new component classes.

---

# Phase 1 — Foundation (position colors + team identity)

## Task 1.1: Position color module (TDD)

**Files:**

- Create: `src/lib/positionColor.ts`
- Test: `src/lib/positionColor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { POSITION_COLOR, positionColor } from "./positionColor";
import { POSITIONS } from "../types";

describe("positionColor", () => {
  it("maps every Position to a non-empty hex color", () => {
    for (const pos of POSITIONS) {
      expect(POSITION_COLOR[pos]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("positionColor() returns the mapped color", () => {
    expect(positionColor("QB")).toBe(POSITION_COLOR.QB);
  });
  it("distinct colors for QB/RB/WR/TE", () => {
    const c = [
      POSITION_COLOR.QB,
      POSITION_COLOR.RB,
      POSITION_COLOR.WR,
      POSITION_COLOR.TE,
    ];
    expect(new Set(c).size).toBe(4);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run src/lib/positionColor.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
import type { Position } from "./types";

// Canonical fantasy position palette (dark theme). Single source of truth;
// CSS mirrors these as --pos-* custom properties.
export const POSITION_COLOR: Record<Position, string> = {
  QB: "#c084fc", // purple
  RB: "#34d399", // green
  WR: "#38bdf8", // blue
  TE: "#fb923c", // orange
  K: "#9aa3b2", // grey
  DST: "#9aa3b2", // grey
};

export function positionColor(pos: Position): string {
  return POSITION_COLOR[pos];
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `npx vitest run src/lib/positionColor.test.ts`
Expected: PASS.

- [ ] **Step 5: Add CSS custom properties**

In `src/index.css`, add to the `:root` block (find `:root {` near the top) these lines:

```css
--pos-QB: #c084fc;
--pos-RB: #34d399;
--pos-WR: #38bdf8;
--pos-TE: #fb923c;
--pos-K: #9aa3b2;
--pos-DST: #9aa3b2;
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/positionColor.ts src/lib/positionColor.test.ts src/index.css
git commit -m "Add canonical position color module

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task 1.2: Team identity generator (TDD)

**Files:**

- Create: `src/lib/mock/teamIdentity.ts`
- Test: `src/lib/mock/teamIdentity.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { makeTeamIdentities } from "./teamIdentity";

describe("makeTeamIdentities", () => {
  it("returns one identity per team", () => {
    expect(makeTeamIdentities(10, 3, 42)).toHaveLength(10);
  });
  it("flags the user's slot (1-based) as isUser and names it 'Your Team'", () => {
    const t = makeTeamIdentities(10, 3, 42);
    expect(t[2].isUser).toBe(true);
    expect(t[2].name).toBe("Your Team");
    expect(t.filter((x) => x.isUser)).toHaveLength(1);
  });
  it("is deterministic for the same seed", () => {
    expect(makeTeamIdentities(12, 1, 7)).toEqual(makeTeamIdentities(12, 1, 7));
  });
  it("gives every team initials and a hex color", () => {
    for (const t of makeTeamIdentities(8, 1, 99)) {
      expect(t.initials).toMatch(/^[A-Z]{1,2}$/);
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("non-user names are unique within a draft", () => {
    const names = makeTeamIdentities(12, 1, 5)
      .filter((t) => !t.isUser)
      .map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run src/lib/mock/teamIdentity.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
export interface TeamIdentity {
  name: string;
  initials: string;
  color: string;
  isUser: boolean;
}

// Curated, license-safe fun manager names.
const NAMES = [
  "Bed Bath & Bijan",
  "Caleb Me Maybe",
  "Tua Towers",
  "Amon a Mission",
  "Knockin' Evans",
  "Saquon the Barker",
  "Hurts So Good",
  "Chase the Bag",
  "Lamb Chops",
  "CMC Hammer",
  "Kelce Grammer",
  "Puka Matata",
  "Nabers Hood",
  "Jefferson Airplane",
  "Gibbs Me More",
  "London Calling",
];
const COLORS = [
  "#e11d48",
  "#7c3aed",
  "#0891b2",
  "#16a34a",
  "#ea580c",
  "#2563eb",
  "#db2777",
  "#0d9488",
  "#ca8a04",
  "#4f46e5",
  "#65a30d",
  "#c026d3",
  "#dc2626",
  "#0284c7",
  "#9333ea",
  "#15803d",
];

// Mulberry32 — small deterministic PRNG.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function initials(name: string): string {
  const words = name
    .replace(/[^A-Za-z ]/g, "")
    .trim()
    .split(/\s+/);
  const ltrs = (words[0]?.[0] ?? "T") + (words[1]?.[0] ?? "");
  return ltrs.toUpperCase().slice(0, 2);
}

// Generate identities; userSlot is 1-based. Names/colors shuffled by seed; the
// user's slot is always "Your Team".
export function makeTeamIdentities(
  teams: number,
  userSlot: number,
  seed: number,
): TeamIdentity[] {
  const r = rng(seed);
  const pool = NAMES.slice();
  // Fisher–Yates shuffle of the name pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: TeamIdentity[] = [];
  let n = 0;
  for (let t = 0; t < teams; t++) {
    const isUser = t === userSlot - 1;
    const name = isUser ? "Your Team" : pool[n++ % pool.length];
    out.push({
      name,
      initials: isUser ? "YT" : initials(name),
      color: COLORS[t % COLORS.length],
      isUser,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `npx vitest run src/lib/mock/teamIdentity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/teamIdentity.ts src/lib/mock/teamIdentity.test.ts
git commit -m "Add seeded team-identity generator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task 1.3: Store team identity on `MockState`

**Files:**

- Modify: `src/lib/mock/types.ts`, `src/lib/mock/engine.ts`
- Test: `src/lib/mock/engine.test.ts`

- [ ] **Step 1: Add the field to `MockState`**

In `src/lib/mock/types.ts`, add the import and field:

```typescript
import type { TeamIdentity } from "./teamIdentity";
```

and inside `interface MockState`, after `settings: MockSettings;`:

```typescript
  teams: TeamIdentity[]; // generated team identities (name/avatar/isUser)
```

- [ ] **Step 2: Write a failing test in `engine.test.ts`**

Add (the file already imports `createMock` and builds a `league`/`settings`):

```typescript
it("createMock generates one team identity per team, user flagged", () => {
  const m = createMock(
    league,
    { teams: 10, userSlot: 4, thirdRoundReversal: false },
    42,
  );
  expect(m.teams).toHaveLength(10);
  expect(m.teams[3].isUser).toBe(true);
});
```

- [ ] **Step 3: Run — verify it fails**

Run: `npx vitest run src/lib/mock/engine.test.ts`
Expected: FAIL (`m.teams` undefined / type error).

- [ ] **Step 4: Populate in `createMock`**

In `src/lib/mock/engine.ts`, import the generator:

```typescript
import { makeTeamIdentities } from "./teamIdentity";
```

In `createMock`, where the `MockState` object is built (the `return { ... }`), add:

```typescript
    teams: makeTeamIdentities(settings.teams, settings.userSlot, seed),
```

(Use the same `seed` argument `createMock` already receives.)

- [ ] **Step 5: Run — verify it passes**

Run: `npx vitest run src/lib/mock/engine.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mock/types.ts src/lib/mock/engine.ts src/lib/mock/engine.test.ts
git commit -m "Generate team identities at draft start

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 2 — Draft board (hero)

## Task 2.1: Avatar component

**Files:**

- Create: `src/components/mock/Avatar.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Implement `Avatar`**

```tsx
interface Props {
  initials: string;
  color: string;
  size?: number; // px, default 30
  ring?: boolean; // highlight (Your Team)
}

export function Avatar({ initials, color, size = 30, ring = false }: Props) {
  return (
    <span
      className={`otc-avatar${ring ? " ring" : ""}`}
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </span>
  );
}
```

- [ ] **Step 2: Add CSS**

In `src/index.css` add:

```css
.otc-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 800;
  line-height: 1;
}
.otc-avatar.ring {
  box-shadow: 0 0 0 2px #34d399;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/mock/Avatar.tsx src/index.css
git commit -m "Add Avatar component for team identity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task 2.2: Reskin the draft board into a card grid + team header

**Files:**

- Modify: `src/components/mock/DraftBoardGrid.tsx`, `src/index.css`

**Reference for structure** — keep the props/`buildBoardGrid`/`userColumnIndex` usage; replace the `<table>` and the `board-peek` markup with the card grid. The available-players peek stays for now (Phase 3 replaces the pool that feeds drafting; the board sheet's peek can remain but should adopt card styling).

- [ ] **Step 1: Replace the board header + table with a team-identity header strip and a CSS-grid card board**

In `DraftBoardGrid.tsx`, read `state.teams` for identities. Replace the `<table className="board-grid">…</table>` block with:

```tsx
<div className="board-cardgrid" style={{ ["--cols" as string]: teams }}>
  <div className="bcg-teamrow">
    {state.teams.map((t, i) => (
      <div key={i} className={`bcg-team${t.isUser ? " you" : ""}`}>
        <Avatar
          initials={t.initials}
          color={t.color}
          size={28}
          ring={t.isUser}
        />
        <span className="bcg-tname">{t.name}</span>
      </div>
    ))}
  </div>
  {grid.map((row, r) => (
    <div className="bcg-row" key={r}>
      {row.map((cell, t) => (
        <div
          key={t}
          className={
            "bcg-cell " +
            (cell ? `pos-${cell.position} done` : "empty") +
            (t === userCol ? " user-col" : "") +
            (cell && onPickClick ? " clickable" : "")
          }
          onClick={
            cell && onPickClick ? () => onPickClick(cell.overall) : undefined
          }
        >
          {cell ? (
            <>
              <span className="bcg-pick">{cell.label}</span>
              <span className="bcg-name">{cell.name}</span>
              <span className="bcg-meta">{cell.position}</span>
            </>
          ) : (
            <span className="bcg-pick faded">{/* upcoming label */}</span>
          )}
        </div>
      ))}
    </div>
  ))}
</div>
```

Import `Avatar` at top: `import { Avatar } from "./Avatar";`. Keep the existing `board-head` (Close) and the surrounding sheet wrapper.

- [ ] **Step 2: Add the board card CSS**

In `src/index.css`:

```css
.board-cardgrid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bcg-teamrow,
.bcg-row {
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  gap: 6px;
}
.bcg-team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 2px;
}
.bcg-team.you {
  background: #0f1a14;
  border-radius: 8px;
}
.bcg-tname {
  font-size: 10px;
  color: #c2c9d6;
  max-width: 92px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bcg-cell {
  border-radius: 8px;
  padding: 6px 7px;
  min-height: 46px;
  position: relative;
  background: color-mix(in srgb, var(--c, #2a2f3a) 14%, #10141d);
  border-left: 3px solid var(--c, #2a2f3a);
}
.bcg-cell.empty {
  background: #0d1017;
  border-left-color: #1b2130;
}
.bcg-cell .bcg-pick {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 9px;
  opacity: 0.6;
}
.bcg-name {
  display: block;
  font-weight: 700;
  font-size: 11.5px;
  color: #eef1f6;
}
.bcg-meta {
  font-size: 9px;
  color: #aab2c2;
}
.bcg-cell.user-col {
  outline: 1px solid #245c39;
}
.bcg-cell.clickable {
  cursor: pointer;
}
.pos-QB {
  --c: var(--pos-QB);
}
.pos-RB {
  --c: var(--pos-RB);
}
.pos-WR {
  --c: var(--pos-WR);
}
.pos-TE {
  --c: var(--pos-TE);
}
.pos-K {
  --c: var(--pos-K);
}
.pos-DST {
  --c: var(--pos-DST);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual verification (gate)**

Start the dev server, open a mock, open the Draft board. Verify: team header strip shows avatars + names, **Your Team** highlighted; made picks are position-colored cards with pick label/name/pos; columns line up. No raw `<table>` look.

- [ ] **Step 5: Commit**

```bash
git add src/components/mock/DraftBoardGrid.tsx src/index.css
git commit -m "Reskin draft board as position-colored card grid with team header

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task 2.3: On-the-clock card with inline timer

**Files:**

- Modify: `src/components/mock/MockDraft.tsx`, `src/index.css`

The board's `current` cell (and/or a hero strip) should show the timer. Simplest high-impact version: render a prominent **on-the-clock card** above the pool showing the team on the clock (avatar + name), the pick label, and the existing `timerUi`.

- [ ] **Step 1: Add the on-the-clock hero card**

In `MockDraft.tsx`, just below `<OnTheClockBanner … />`, add (uses `state.teams`, `onClock`, `round`, `overall`, `timerUi`):

```tsx
{
  !isComplete(state) && (
    <div className={`otc-clockcard${isUser ? " you" : ""}`}>
      <Avatar
        initials={state.teams[onClock].initials}
        color={state.teams[onClock].color}
        size={34}
        ring={isUser}
      />
      <div className="occ-who">
        <div className="occ-name">{state.teams[onClock].name}</div>
        <div className="occ-pick">
          On the clock · {formatPick(overall, state.settings.teams)}
        </div>
      </div>
      <div className="occ-timer">{timerUi}</div>
    </div>
  );
}
```

Import `Avatar`: `import { Avatar } from "./Avatar";`.

- [ ] **Step 2: Add CSS**

```css
.otc-clockcard {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #10141d;
  border: 1px solid #232938;
  border-radius: 12px;
  margin: 8px 0;
}
.otc-clockcard.you {
  background: #0f1a14;
  border-color: #245c39;
}
.occ-who {
  flex: 1;
}
.occ-name {
  font-weight: 800;
  font-size: 15px;
}
.occ-pick {
  font-size: 11px;
  color: #8b93a4;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.occ-timer {
  font-size: 22px;
  font-weight: 800;
}
.otc-clockcard.you .occ-timer {
  color: #7ff0bd;
}
```

- [ ] **Step 3: Typecheck + manual verification (gate)**

Run `npx tsc --noEmit`. Then in-app: the on-the-clock card shows the current team (avatar + name) and the live countdown; it highlights green on your turn.

- [ ] **Step 4: Commit**

```bash
git add src/components/mock/MockDraft.tsx src/index.css
git commit -m "Add on-the-clock card with inline timer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 3 — Pick pool (your tier list)

## Task 3.1: Extract `PickPool` with tier grouping, flags, position cards

**Files:**

- Create: `src/components/mock/PickPool.tsx`
- Modify: `src/components/mock/MockDraft.tsx`, `src/index.css`

Goal: replace the `ul.mock-available` block in `MockDraft` with a `PickPool` component that groups available players by **tier** (from `player.tier`), shows a **tier banner** per group, renders position-colored rows with the **target/avoid flag**, a **📝 note** indicator, ADP, a **centered ＋** draft button, and a clickable **name** (calls `onOpenPlayer`). Keep the existing value/fall indicator.

- [ ] **Step 1: Create `PickPool.tsx`**

```tsx
import type { Player } from "../../types";

interface Props {
  players: Player[]; // already filtered by position chip, available
  canDraft: boolean;
  overall: number;
  onDraft: (id: string) => void;
  onOpenPlayer: (id: string) => void;
}

// Group consecutive players by tier (players arrive in overall-rank order).
function groupByTier(
  players: Player[],
): { tier: number | null; players: Player[] }[] {
  const out: { tier: number | null; players: Player[] }[] = [];
  for (const p of players) {
    const last = out[out.length - 1];
    if (last && last.tier === p.tier) last.players.push(p);
    else out.push({ tier: p.tier, players: [p] });
  }
  return out;
}

export function PickPool({ players, canDraft, onDraft, onOpenPlayer }: Props) {
  const groups = groupByTier(players);
  return (
    <div className="pickpool">
      {groups.map((g, i) => (
        <div key={i}>
          <div className="pp-tier">
            Tier {g.tier ?? "—"}{" "}
            <span className="pp-cnt">· {g.players.length}</span>
          </div>
          {g.players.map((p) => (
            <div
              key={p.id}
              className={`pp-row pos-${p.position} flag-${p.flag}`}
            >
              <span className="pp-pos">{p.position}</span>
              <button className="pp-name" onClick={() => onOpenPlayer(p.id)}>
                {p.name}
              </button>
              <span className="pp-team">· {p.team}</span>
              {p.flag !== "none" && (
                <span className={`pp-flag ${p.flag}`} title={p.flag}>
                  {p.flag === "target" ? "★" : "⊘"}
                </span>
              )}
              {p.notes?.trim() && (
                <span
                  className="pp-note"
                  title="Has a note"
                  data-note={p.notes}
                >
                  📝
                </span>
              )}
              <span className="pp-adp">
                {p.adp == null ? "" : `ADP ${Number(p.adp.toFixed(1))}`}
              </span>
              <button
                className="pp-draft"
                disabled={!canDraft}
                title={`Draft ${p.name}`}
                onClick={() => onDraft(p.id)}
              >
                ＋
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Use it in `MockDraft.tsx`**

Replace the entire `<ul className="mock-available">…</ul>` block with:

```tsx
<PickPool
  players={avail.slice(0, 100)}
  canDraft={isUser && !revealing}
  overall={overall}
  onDraft={onDraft}
  onOpenPlayer={(id) => setOpenPlayer(id)}
/>
```

Add the state near the other `useState`s: `const [openPlayer, setOpenPlayer] = useState<string | null>(null);`. Import `PickPool`. (The `availRows`/`AvailRow` marker logic can be removed; tier banners replace the "your pick" lines for now — note this in the commit.)

- [ ] **Step 3: Add CSS (cards, flags, centered ＋)**

```css
.pickpool {
  display: flex;
  flex-direction: column;
}
.pp-tier {
  padding: 6px 12px;
  background: #10141d;
  border-left: 3px solid #34d399;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #cfd6e2;
}
.pp-cnt {
  color: #7c869a;
  font-weight: 500;
}
.pp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 9px;
  border-left: 3px solid var(--c, #2a2f3a);
  border-bottom: 1px solid #11151d;
}
.pp-row:hover {
  background: #10141d;
}
.pp-pos {
  font-size: 9.5px;
  font-weight: 800;
  color: #06080d;
  background: var(--c, #888);
  border-radius: 4px;
  padding: 2px 5px;
  min-width: 30px;
  text-align: center;
}
.pp-name {
  background: none;
  border: none;
  color: #eef1f6;
  font-weight: 700;
  font-size: 13.5px;
  cursor: pointer;
  padding: 0;
}
.pp-name:hover {
  text-decoration: underline;
}
.pp-team {
  font-size: 11px;
  color: #8b93a4;
}
.pp-flag.target {
  color: #34d399;
}
.pp-flag.avoid {
  color: #f87171;
}
.pp-note {
  cursor: pointer;
}
.pp-adp {
  margin-left: auto;
  font-size: 11px;
  color: #8b93a4;
  font-variant-numeric: tabular-nums;
}
.pp-draft {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #245c39;
  background: #11241a;
  color: #7ff0bd;
  border-radius: 7px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.pp-draft:disabled {
  opacity: 0.4;
  cursor: default;
}
```

(The flex `align-items:center` + `justify-content:center` on `.pp-draft` is what fixes the off-center ＋.)

- [ ] **Step 4: Typecheck + manual verification (gate)**

Run `npx tsc --noEmit`. In-app: pool shows tier banners, position-colored rows, target/avoid markers, ADP, note icon, and a centered ＋ that drafts on your turn.

- [ ] **Step 5: Commit**

```bash
git add src/components/mock/PickPool.tsx src/components/mock/MockDraft.tsx src/index.css
git commit -m "Replace mock pool with tier-grouped position-colored PickPool

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task 3.2: Note popover (clamped on-screen)

**Files:**

- Modify: `src/components/mock/PickPool.tsx`, `src/index.css`

- [ ] **Step 1: Add popover state + clamped positioning**

In `PickPool`, add:

```tsx
import { useState } from "react";
// inside component:
const [note, setNote] = useState<{ text: string; x: number; y: number } | null>(
  null,
);
```

Change the note icon to open it, clamping x so the 230px popover stays in the viewport:

```tsx
<span
  className="pp-note"
  title="Read note"
  onClick={(e) => {
    const r = (e.target as HTMLElement).getBoundingClientRect();
    const x = Math.min(r.left, window.innerWidth - 240);
    setNote({ text: p.notes, x: Math.max(8, x), y: r.bottom + 6 });
  }}
>
  📝
</span>
```

Render once at the end of the component:

```tsx
{
  note && (
    <>
      <div className="pp-note-scrim" onClick={() => setNote(null)} />
      <div className="pp-note-pop" style={{ left: note.x, top: note.y }}>
        <div className="pp-note-lbl">Your note</div>
        {note.text}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add CSS**

```css
.pp-note-scrim {
  position: fixed;
  inset: 0;
  z-index: 39;
}
.pp-note-pop {
  position: fixed;
  z-index: 40;
  width: 230px;
  background: #161c27;
  border: 1px solid #2f3850;
  border-radius: 9px;
  padding: 9px 11px;
  font-size: 12px;
  color: #d7dce6;
  box-shadow: 0 12px 30px -8px #000a;
}
.pp-note-lbl {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7c869a;
  margin-bottom: 3px;
}
```

- [ ] **Step 3: Typecheck + manual verification (gate)**

`npx tsc --noEmit`. In-app: clicking 📝 opens the note; it never runs off the right edge; clicking elsewhere closes it.

- [ ] **Step 4: Commit**

```bash
git add src/components/mock/PickPool.tsx src/index.css
git commit -m "Add on-screen-clamped note popover to the pick pool

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task 3.3: Capped optional columns (bye / proj / VOR)

**Files:**

- Modify: `src/components/mock/PickPool.tsx`, `src/components/mock/MockDraft.tsx`, `src/index.css`

- [ ] **Step 1: Add an `extraCols` prop + a capped picker**

Define the option set and cap in `PickPool`:

```tsx
export type PoolCol = "bye" | "proj" | "vor";
export const POOL_COL_CAP = 3;
```

Add prop `extraCols: PoolCol[]` and render the values per row after ADP:

```tsx
{
  extraCols.includes("bye") && <span className="pp-x">{p.byeWeek ?? "—"}</span>;
}
{
  extraCols.includes("proj") && (
    <span className="pp-x">{projById[p.id] ?? "—"}</span>
  );
}
{
  extraCols.includes("vor") && (
    <span className="pp-x">{vorById[p.id] ?? "—"}</span>
  );
}
```

(Thread `projById`/`vorById` from `MockDraft` props if available there; if not, pass `{}` and show bye only — bye comes from `player.byeWeek` and needs no extra data.) Add a small header control above the pool listing the three toggles, disabling unchecked ones once `extraCols.length >= POOL_COL_CAP`.

- [ ] **Step 2: Manage `extraCols` state in `MockDraft`**

```tsx
const [extraCols, setExtraCols] = useState<PoolCol[]>(["bye"]);
```

Pass to `PickPool`. The toggle handler enforces the cap:

```tsx
const toggleCol = (c: PoolCol) =>
  setExtraCols((cur) =>
    cur.includes(c)
      ? cur.filter((x) => x !== c)
      : cur.length >= POOL_COL_CAP
        ? cur
        : [...cur, c],
  );
```

- [ ] **Step 3: CSS**

```css
.pp-x {
  font-size: 11px;
  color: #8b93a4;
  min-width: 30px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pp-colbar {
  display: flex;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  color: #8b93a4;
}
.pp-colbar button {
  background: #10141d;
  border: 1px solid #2b3242;
  color: #aab2c2;
  border-radius: 999px;
  padding: 2px 9px;
  cursor: pointer;
}
.pp-colbar button.on {
  background: #16331f;
  border-color: #245c39;
  color: #7ff0bd;
}
.pp-colbar button:disabled {
  opacity: 0.4;
  cursor: default;
}
```

- [ ] **Step 4: Typecheck + manual verification (gate)**

`npx tsc --noEmit`. In-app: bye column shows by default; you can add up to 3 optional columns total; the 4th toggle is disabled until you remove one.

- [ ] **Step 5: Commit**

```bash
git add src/components/mock/PickPool.tsx src/components/mock/MockDraft.tsx src/index.css
git commit -m "Add capped optional pool columns (bye/proj/vor)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 4 — Player slide panel (coming soon)

## Task 4.1: `PlayerPanel` slide-over + wire name-click

**Files:**

- Create: `src/components/mock/PlayerPanel.tsx`
- Modify: `src/components/mock/MockDraft.tsx`, `src/index.css`

- [ ] **Step 1: Create `PlayerPanel.tsx`**

```tsx
import type { Player } from "../../types";
import { POSITION_COLOR } from "../../lib/positionColor";

interface Props {
  player: Player | null;
  onClose: () => void;
}

export function PlayerPanel({ player, onClose }: Props) {
  return (
    <>
      <div className={`pp-scrim${player ? " open" : ""}`} onClick={onClose} />
      <aside
        className={`player-panel${player ? " open" : ""}`}
        aria-hidden={!player}
      >
        {player && (
          <>
            <div className="ppx-head">
              <button className="ppx-x" onClick={onClose}>
                ✕
              </button>
              <h3 className="ppx-name">{player.name}</h3>
              <span
                className="ppx-pos"
                style={{ background: POSITION_COLOR[player.position] }}
              >
                {player.position}
              </span>
              <span className="ppx-team">· {player.team}</span>
            </div>
            <div className="ppx-body">
              <span className="ppx-soon">Player profile · Coming soon</span>
              <div className="ppx-stub">
                <h4>Season outlook</h4>
                <div className="ppx-bars">
                  <div />
                  <div />
                  <div />
                </div>
              </div>
              <div className="ppx-stub">
                <h4>Recent news</h4>
                <div className="ppx-bars">
                  <div />
                  <div />
                </div>
              </div>
              <div className="ppx-stub">
                <h4>Matchup &amp; schedule</h4>
                <div className="ppx-bars">
                  <div />
                  <div />
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Render it in `MockDraft`**

Add near the end of the returned JSX:

```tsx
<PlayerPanel
  player={
    openPlayer ? (state.pool.find((p) => p.id === openPlayer) ?? null) : null
  }
  onClose={() => setOpenPlayer(null)}
/>
```

Import `PlayerPanel`. (`openPlayer` state + `onOpenPlayer` were added in Task 3.1.)

- [ ] **Step 3: CSS**

```css
.pp-scrim {
  position: fixed;
  inset: 0;
  background: #000a;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
  z-index: 60;
}
.pp-scrim.open {
  opacity: 1;
  pointer-events: auto;
}
.player-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  max-width: 86vw;
  background: #0d1119;
  border-left: 1px solid #2b3242;
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 70;
  overflow: auto;
}
.player-panel.open {
  transform: translateX(0);
}
.ppx-head {
  padding: 16px;
  border-bottom: 1px solid #1a1f2b;
  position: relative;
}
.ppx-x {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: #8b93a4;
  font-size: 18px;
  cursor: pointer;
}
.ppx-name {
  margin: 0 0 6px;
  font-size: 18px;
}
.ppx-pos {
  font-size: 10px;
  font-weight: 800;
  color: #06080d;
  border-radius: 5px;
  padding: 2px 7px;
}
.ppx-team {
  color: #8b93a4;
  font-size: 12px;
  margin-left: 6px;
}
.ppx-body {
  padding: 14px 16px;
}
.ppx-soon {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: #fbbf24;
  background: #2b2612;
  border: 1px solid #5c4d24;
  border-radius: 999px;
  padding: 2px 9px;
  margin-bottom: 14px;
}
.ppx-stub {
  border: 1px dashed #2b3242;
  border-radius: 9px;
  padding: 12px;
  margin-bottom: 10px;
}
.ppx-stub h4 {
  margin: 0 0 6px;
  font-size: 12px;
  color: #aab2c2;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ppx-bars div {
  height: 8px;
  border-radius: 4px;
  background: #161c27;
  margin: 6px 0;
}
```

- [ ] **Step 4: Typecheck + manual verification (gate)**

`npx tsc --noEmit`. In-app: clicking a player **name** slides the panel in with the "Coming soon" shell; ✕ or scrim closes it; the ＋ still drafts (separate control).

- [ ] **Step 5: Commit**

```bash
git add src/components/mock/PlayerPanel.tsx src/components/mock/MockDraft.tsx src/index.css
git commit -m "Add player slide-over panel (coming soon shell)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 5 — Pool tabs: Board / Queue (Queue = coming soon)

## Task 5.1: Tabs above the pool with a Queue coming-soon panel

**Files:**

- Modify: `src/components/mock/MockDraft.tsx`, `src/index.css`

- [ ] **Step 1: Add tab state + markup**

In `MockDraft`, add `const [poolTab, setPoolTab] = useState<"board" | "queue">("board");`. Wrap the position chips + `PickPool` so they render only when `poolTab === "board"`, and add the tab bar above them:

```tsx
<div className="pool-tabs">
  <button
    className={poolTab === "board" ? "on" : ""}
    onClick={() => setPoolTab("board")}
  >
    Board
  </button>
  <button
    className={poolTab === "queue" ? "on" : ""}
    onClick={() => setPoolTab("queue")}
  >
    Queue
  </button>
</div>;
{
  poolTab === "queue" && (
    <div className="queue-soon">
      <span className="ppx-soon">Queue · Coming soon</span>
      <p>
        Add players to a queue and drag them up and down to plan your picks.
        Landing soon.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: CSS**

```css
.pool-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
}
.pool-tabs button {
  background: none;
  border: none;
  color: #8b93a4;
  font-weight: 700;
  font-size: 13px;
  padding: 6px 10px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.pool-tabs button.on {
  color: #eef1f6;
  border-bottom-color: #34d399;
}
.queue-soon {
  padding: 24px 16px;
  color: #8b93a4;
  text-align: center;
}
```

- [ ] **Step 3: Typecheck + manual verification (gate)**

`npx tsc --noEmit`. In-app: Board/Queue tabs switch; Queue shows the coming-soon panel; Board shows the pool.

- [ ] **Step 4: Commit**

```bash
git add src/components/mock/MockDraft.tsx src/index.css
git commit -m "Add Board/Queue pool tabs; Queue coming-soon shell

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 6 — Setup + roster/summary polish

## Task 6.1: Reskin `MockSetup` + confirm customization

**Files:**

- Modify: `src/components/mock/MockSetup.tsx`, `src/index.css`

- [ ] **Step 1: Read the current setup**

Open `src/components/mock/MockSetup.tsx`. It already exposes teams, userSlot, rounds, thirdRoundReversal (and reads the active tier list for value flags). Ensure these controls are present and clear; if a **tier-list selector** is not present and the league has multiple lists, add a `<select>` bound to the list the mock seeds from (default = the league's default list). Wrap the form in `.mock-setup-card` for the dark card styling.

- [ ] **Step 2: Add CSS**

```css
.mock-setup-card {
  max-width: 460px;
  margin: 24px auto;
  background: #10141d;
  border: 1px solid #232938;
  border-radius: 14px;
  padding: 22px;
}
.mock-setup-card h2 {
  margin: 0 0 14px;
}
.mock-setup-card label {
  display: block;
  font-size: 12px;
  color: #8b93a4;
  margin: 12px 0 4px;
}
```

- [ ] **Step 3: Typecheck + manual verification (gate)**

`npx tsc --noEmit`. In-app: the setup screen is a clean dark card; you can set teams, slot, rounds, reversal, and pick the tier list; Start works.

- [ ] **Step 4: Commit**

```bash
git add src/components/mock/MockSetup.tsx src/index.css
git commit -m "Reskin mock setup as a dark card with clear customization

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task 6.2: Polish `MockSummary` + roster line to match

**Files:**

- Modify: `src/components/mock/MockSummary.tsx`, `src/components/mock/MockDraft.tsx` (the `.mock-myroster` line), `src/index.css`

- [ ] **Step 1: Apply card/position-color styling**

In `MockSummary`, render the user's roster as position-colored cards (reuse `pos-*` classes + `Avatar` for the team). In `MockDraft`, restyle `.mock-myroster` into a compact chip row using the position colors.

- [ ] **Step 2: CSS**

```css
.mock-myroster {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #c2c9d6;
}
.summary-card {
  background: #10141d;
  border: 1px solid #232938;
  border-radius: 10px;
  padding: 10px 12px;
  border-left: 3px solid var(--c, #2a2f3a);
}
```

- [ ] **Step 3: Typecheck + manual verification (gate)**

`npx tsc --noEmit`. Complete a quick mock; the summary uses cards/colors and feels cohesive with the rest.

- [ ] **Step 4: Commit**

```bash
git add src/components/mock/MockSummary.tsx src/components/mock/MockDraft.tsx src/index.css
git commit -m "Polish mock summary and roster to match the dark card system

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task 6.3: Final full-flow verification + suite

**Files:** none.

- [ ] **Step 1: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green, tsc clean.

- [ ] **Step 2: Walk the whole flow in-app**

Setup → draft (on-the-clock card, pool with tiers/flags/notes/columns, name-panel, board grid, Board/Queue tabs) → summary. Confirm dark, cohesive, no leftover table styling, no console errors.

- [ ] **Step 3: Report results** in the conversation.

---

## Self-Review (plan author)

- **Spec coverage:** position colors (1.1) · team identity module + state (1.2, 1.3) · board card grid + team header + Your-Team highlight (2.2) · avatars (2.1) · on-the-clock timer card (2.3) · tier-list pool with breaks/tiers (3.1) · flags (3.1) · notes popover clamped (3.2) · capped optional columns incl. bye (3.3) · centered ＋ (3.1 CSS) · name-click slide panel coming-soon (4.1) · Board/Queue tabs + Queue coming-soon (5.1) · setup customization + reskin (6.1) · roster/summary polish (6.2). All spec items mapped.
- **Placeholder scan:** none — code/CSS provided per step; visual tasks gated by explicit manual checks (appropriate for a reskin).
- **Type consistency:** `TeamIdentity`, `MockState.teams`, `POSITION_COLOR`, `Avatar` props, `PickPool`/`PoolCol`/`POOL_COL_CAP`, `PlayerPanel` props are consistent across tasks.
- **Notes for executor:** (a) Task 3.1 removes the old `availRows`/marker "your pick" lines — tier banners replace them this pass; if desired later, the user-pick markers can return as a pool overlay. (b) `proj`/`vor` columns in 3.3 need `projById`/`vorById`; if those aren't readily threaded into `MockMode`/`MockDraft`, ship `bye` only and leave proj/vor toggles disabled with a tooltip — do not over-plumb for this pass.

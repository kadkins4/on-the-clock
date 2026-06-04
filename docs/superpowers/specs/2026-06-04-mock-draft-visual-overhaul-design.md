# Mock draft visual overhaul — design

Date: 2026-06-04
Branch: `mock-draft-redesign`

## Goal

Replace the "table-y" mock draft with a cohesive **dark, card-based draft room**
that looks good enough to be proud of when article traffic hits. Touch the whole
flow (setup → draft → result), board first. Not pixel-perfect; cohesive and
alive. No real player photos or NFL logos (licensing) — generated avatars only.

## Locked decisions

- **Dark only** for now; skinning is a future option (build behind a small theme
  seam but ship one theme).
- **Card grid, position-colored**: QB purple, RB green, WR blue, TE orange,
  K/DST grey. One shared color module used everywhere.
- **Team identity**: generated name + initials avatar + `isUser` flag per team.
- **On-the-clock card** shows the countdown timer inline (screenshot #8).
- Pick pool = the user's real tier list (breaks, tiers, notes come along).
- Player **name-click** opens a slide-over panel (content "Coming soon").

## Backbone readiness

The mock engine (`src/lib/mock/*`) already emits everything the visuals need:
per-pick `PickCell` with team column, round, `1.04` label, position, name,
`done|current|upcoming` state, and a reach/value signal; snake order; current
pick; summary. **The only data addition is a team-identity layer.** Everything
else is presentation.

## Architecture / units

### 1. Shared foundation (new, small)

- `src/lib/mock/teamIdentity.ts` — pure: given team count, user slot, and a seed,
  return `TeamIdentity[] = { name, initials, color, isUser }`. Deterministic
  (seeded), fun names from a curated pool, distinct colors, user flagged. Unit-tested.
- `src/lib/positionColor.ts` — `POSITION_COLOR: Record<Position,string>` + a
  helper. Single source of truth for the palette; CSS custom props mirror it.
- Team identities are generated at draft start and stored on `MockState`
  (e.g. `teams: TeamIdentity[]`), so every surface reads the same names/avatars.

### 2. Draft board (hero) — `DraftBoardGrid` reskin

- Team-identity header strip: avatar (initials in colored circle) + name,
  **Your Team highlighted**.
- Columns = teams, rows = rounds; position-colored cards with pick label + name
  - `pos·team`; `done` vs faded `upcoming`; reach/value tint from the existing
    signal.
- The `current` cell renders the **on-the-clock card** with the live timer
  (timer state already exists in `MockDraft`).
- A reusable `Avatar` component (initials in a colored circle).

### 3. Pick pool — your tier list (`PickPool`, replaces reused board table)

- Reads the **active tier list** (the same board the user edits), grouped by the
  **tier breaks** with tier banners (reuse tier styling), in overall-rank order.
- **Default columns:** position chip, name, `team`, ADP, **target/avoid flag**,
  note indicator, **＋ draft**.
- **Optional columns (capped at 3):** user can add from a small set —
  **bye week**, projected pts, VOR. A compact "columns" control enforces the cap
  so the pool never gets overwhelming.
- **Notes:** a 📝 indicator on players with notes; click opens a small popover
  that **clamps on-screen** (flip/shift so it never runs off the edge).
- **Position filter chips** (ALL/QB/RB/WR/TE…) as today.
- **＋ draft** button — glyph **centered** in its control.
- Clicking the player **name** (not the ＋) opens the slide panel (§5).

### 4. Pool tabs: Board / Queue

- The pool has two tabs: **Board** (the tier list above) and **Queue**.
- **Queue (this pass = "Coming soon" shell):** the tab exists and renders a
  coming-soon state describing add-to-queue + drag-reorder. The full queue
  (add players, reorder up/down, draft-from-queue) is **backlogged** — it's the
  largest sub-piece and not needed for the article.

### 5. Player slide-over panel (`PlayerPanel`) — new pattern, placeholder content

- Clicking a player name slides a panel in from the right with a dimmed scrim.
- Header: player name + position badge + team. Body: a **"Coming soon"** player
  profile shell (stub sections: outlook, news, matchup). Close via ✕ or scrim.
- Establishes the interaction; **real player-info content is backlogged.**

### 6. Setup screen (`MockSetup`) reskin

- Dark, clean, with clear **start-mock customization**: teams, your draft slot,
  rounds, 3rd-round reversal, and **which tier list** to draft against.
- Bot personalities are **out of scope** (separate future backlog item).

### 7. Roster + summary (`MockSummary`, roster panel)

- Light dark reskin to match (cards, position colors, avatars) so the flow is
  cohesive end-to-end — not a redesign.

## Build phasing (one spec, phased plan)

1. **Foundation + Board** — position colors, team identity, board card grid +
   header + on-the-clock card. (Highest impact; screenshots well.)
2. **Pick pool** — tier-list-aware list, default + capped optional columns,
   flags, notes popover, ＋ draft, name-click hook.
3. **Player slide panel** — coming-soon shell + the name-click interaction.
4. **Pool tabs + Queue shell** — Board/Queue tabs, Queue coming-soon.
5. **Setup + roster/summary polish** — cohesive dark reskin.

## Testing

- `teamIdentity.ts`: deterministic output for a seed, correct count, user slot
  flagged, distinct names/colors — unit-tested.
- `positionColor.ts`: every `Position` mapped — unit-tested.
- Board/pool/panel/setup are presentation; verified by manual in-app checks
  (dark theme, on-the-clock card, name-click panel, note popover on-screen,
  column cap) plus existing engine tests staying green.

## Out of scope / backlog

- **Full queue** (add/reorder/draft-from-queue) — coming-soon this pass.
- **Real player-info content** in the slide panel — coming-soon this pass.
- **Bot personalities** in setup — separate backlog ([[ff_mock_draft_backlog]]).
- **Alternate skins / light theme** — dark only now; theme seam left in place.

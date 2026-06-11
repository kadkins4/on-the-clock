# Handoff: Draft Room — Fantasy Football Mock/Live Draft UI

## Overview
A unified draft-room experience for a fantasy football assistant, used pre-draft and during mock/live drafts. One screen with four tabs — **Players** (pre-draft research/tiers), **Draft** (the working screen during your turn), **Board** (full-league overview, two interchangeable views), and **TV Mode** (a passive, animated "cast" view for in-person draft parties). All tabs read from a single shared draft state, plus a persistent bottom pick strip and a global "on the clock" header.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly**. The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, native, etc.) using its established patterns and libraries — or, if no environment exists yet, choose the most appropriate stack and implement them there.

The primary reference is `Draft Room v3 (Unified).dc.html` — an HTML file with the template markup at the top (inside `<x-dc>`) and the state/logic class below it (inside a `<script>`). Read the template for exact markup/styles and the `Component` class for state shape, derived data, and event handling. Two earlier exploration files are included for context on alternates that were considered.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interaction patterns are final design intent and should be recreated faithfully. Two exceptions, which are simulation scaffolding and NOT part of the product UI:
- The "SIM" control cluster in the app bar (team-count stepper, SIM PICK, AUTO, UNDO, RESET) exists only to demo the prototype. Real implementation gets its picks from the live draft engine/server.
- The countdown timer is decorative (static `0:38`); implement a real synced timer.

## Global Frame (all tabs)

### App Bar (`#0E1218`, bottom border `#1C232C`)
- **Left**: wordmark "On The Clock." — Archivo 800, 19px, `#ECEEF1`, with "Clock" in orange `#FB5A2D`; below it a mono microlabel (IBM Plex Mono 9px, letter-spacing 2px, `#5C6470`).
- **Center**: the **on-the-clock pill** — `#12161D` bg, 999px radius, 1px border `#242C37` (turns gold `#D9A53F` when it is the local user's turn). Contains a 30px round team avatar (solid color + 2-letter initials), a green status microlabel "● ON THE CLOCK" (IBM Plex Mono 9px, `#2FC76D`), and the team name (Archivo 700 14px) with pick number (e.g. "· 3.04", mono 11px `#707A87`).
- **Right**: timer — Archivo 800, 30px, letter-spacing −1px; status line under it (mono 9.5px `#707A87`), e.g. "R3 · PICK 28 OF 180".
- **Tab row**: PLAYERS / DRAFT / BOARD / TV MODE. Barlow Condensed 700, 15px, letter-spacing 1.5px. Inactive `#707A87`; active `#ECEEF1` with a 3px orange underline.

### Bottom Pick Strip (sticky, all tabs)
Horizontally scrolling row of 118px-wide pick cards covering the entire draft (rounds × teams). Card: 7px radius, `padding 7px 9px`.
- Completed pick: position-tint background (see Position Key), player short name `#ECEEF1`, pick number + team abbr in mono 9px.
- Current pick: gold dashed-feel highlight — bg `rgba(217,165,63,0.07)`, border `#D9A53F`, label "ON THE CLOCK" in green.
- Future picks: `#12161D` bg, team name in `#5C6470`.
- The local user's picks always have pick numbers in gold and a gold-tinted border `rgba(217,165,63,0.45)`.
- Clicking a completed pick opens the Player Card overlay.

## Screens / Views

### 1. PLAYERS tab — pre-draft research list
- **Toolbar**: search input (`#161B23` bg, `#2A323D` border, 8px radius, 15px Barlow Condensed; placeholder `#5C6470`), position chips ALL/QB/RB/WR/TE/K/DST (999px radius pills; active = orange bg/white text, inactive = transparent bg/`#9AA3AE` text/`#2A323D` border), and a HIDE DRAFTED toggle button (turns orange when on, label "✓ HIDING DRAFTED").
- **Table** (`#12161D` panel, `#222933` border, 12px radius). Column header row in mono 9px `#5C6470`: # / ★ / PLAYER / POS / TEAM / ADP / PROJ / BYE / STATUS.
- **Tier headers** group rows by ADP-derived tiers (Tier 1 = ADP ≤ 10, then ≤ 24, ≤ 40, ≤ 60, ≤ 90, ≤ 140, rest). Header: `#0E1218` band with a 3px orange tick and "TIER N" mono label.
- **Rows**: rank (mono `#707A87`), star toggle (☆ `#3E4650` → ★ gold) which adds to My Queue, player name (Barlow Condensed 600, 15px, clickable → Player Card), positional rank like "WR12" colored with the position hue, team/ADP/PROJ/BYE in mono 11px, and STATUS: an orange DRAFT button if available, or "3.04 · CB" (pick · drafting-team) if taken. Drafted rows render at 40% opacity.

### 2. DRAFT tab — the working screen ("Broadcast Desk")
Three-column grid: **280px / flexible / 290px**, 14px gaps.
- **Left column** (stacked panels):
  - *Clock panel* (`#161B23`, 12px radius; border goes gold when it's your turn): green "● ON THE CLOCK" microlabel, team name (Archivo 800 21px), status line, big timer (Archivo 800 46px), "NEXT: XX → XX → XX" line, and a gold "★ YOU ARE NOW ON THE CLOCK" banner when applicable.
  - *My Queue* (`#12161D` panel): rows with position-color left edge, name, "POS · ADP n" meta, small orange DRAFT button, ✕ remove. Empty state: "star players to build your queue" in `#3E4650`.
  - *My Roster* (`#12161D` panel): header shows needs summary in gold mono ("QB1 · RB2 · WR1 · TE0"); rows are position-tinted with a solid position badge, name, and R# (or $ in auction).
- **Middle column — BEST AVAILABLE** (the centerpiece): header row with title (Archivo 700 15px), search input, and ALL/QB/RB/WR/TE chips. Below: up to 9 rows — rank, star toggle, position badge (34px wide, solid position color, white—or near-black on TE—text), name (15px, clickable → card), "TEAM · BYE n", "ADP n", auction $ value in gold (auction mode only), orange DRAFT button.
- **Right column — ROUND N strip**: compact list of every pick in the current round: pick number, team abbr, player name. Completed = position tint; current = gold dashed outline with green "ON THE CLOCK"; future = "—" rows at low contrast.

### 3. BOARD tab — league overview
Toggle pill pair at top: **THE WALL** / **LOCKER ROOM** (active = orange). Both views show the local user's column/header with a gold outline.
- **THE WALL** — classic draft grid on `#0E1218`. Header row: team avatar (22px circle) + name + slot (and remaining $ in auction mode). Left rail: round number + direction arrow (→/← for snake, $ for auction). Cells (min-height 48px, 6px radius, 4px position-color left border, position-tint bg): player short name + pick number, sub-line "POS · TEAM · B#" in the position's light text color. Current pick cell: gold 2px dashed outline, "ON THE CLOCK" in green. Click any filled cell → Player Card.
- **LOCKER ROOM** — roster-first columns, one per team: header card (avatar, name, slot, gold remaining budget in auction), then that team's picks stacked as position-tinted mini cards (name, POS, R#/$), then a needs summary footer ("QB1 · RB2 · …", dashed top border).

### 4. TV MODE tab — cast view for in-person drafts
Near-black stage (`#07090C`, 16px radius, inset glow shadow `inset 0 0 80px rgba(0,0,0,0.6)`). Explicitly **read-only**: it mirrors the draft and never controls or affects other devices. In production this should be launchable as a separate cast window/route; in the prototype it's a tab.
- **Header**: pulsing green "LIVE · ON THE CLOCK" + 44px avatar + team name at Archivo 800 38px; centered "THE BIG BOARD." title; right side has a 56px timer and next-up line.
- **Split-flap board** (current round, one row per pick): pick number, team abbr, then **12 letter tiles** (28×38px, 4px radius, vertical gradient `#232A33 → #181E26 48% → #10151B 52% → #1C222B`, IBM Plex Mono 700 19px) spelling the player's surname; solid position badge at the end. **When a new pick lands, tiles animate in sequentially**: `rotateX(95deg) → 0` over 0.4s each, staggered 50ms per tile (`flapIn` keyframes). Current pick row has a gold dashed outline and a pulsing "ON THE CLOCK".
- **Right rail**: *Latest-pick splash card* — slides/scales in (`scale(0.85) translateY(14px) → none`, 0.55s, `cubic-bezier(0.2, 0.9, 0.3, 1.2)`) with pick label, player name at Archivo 800 27px, position badge, team/bye, "by <team>" in gold. Below: *UP NEXT* panel listing the next 3 teams with avatars.
- **Bottom ticker**: full-width marquee of the last 10 picks (pick label + position color square + name), translating left 50% over 24s, looped (content duplicated 2×).

### Player Card overlay (opens from any tab)
Modal over `rgba(4,6,9,0.72)` scrim, centered. 320px card: `#161B23` shell, 14px radius, 11px padding; inner frame with **3px solid border in the player's position color**, `#11151C` bg, 9px radius. Contents: position badge + ✕ CLOSE button row; name plate (Archivo 800 19px on `#0B0E13`); meta line "POS — TEAM · BYE n"; 3-stat grid ADP / PROJ / VALUE (mono; labels 9px `#707A87`, values 700 16px, VALUE in gold); status strip in the position tint — green "✓ STILL AVAILABLE" or "DRAFTED 2.03 · TEAM NAME".

## Interactions & Behavior
- **Drafting**: DRAFT buttons (Players tab, Best Available, My Queue) assign that player to the team currently on the clock and advance the draft. Drafted players disappear from available lists, dim in the Players table, and appear on Board/strip/TV instantly — all views derive from one state.
- **Queue (★)**: toggling the star on any list adds/removes the player from My Queue. Queued players are auto-removed from the queue display once drafted by anyone.
- **Search/filters**: Players tab and Best Available each have independent search + position filters. Search is simple case-insensitive substring on name.
- **Snake/linear/auction**: snake reverses slot order on even rounds (arrows on the Wall rail flip per round); auction replaces round labels with $ values and shows remaining budget (start $200/team) on team headers, roster rows, and the Wall header.
- **6–14 teams**: every grid is column-count-driven (`repeat(teamCount, minmax(0,1fr))`); cells truncate with ellipsis rather than wrap. Board total = teams × 15 rounds.
- **"Your turn" emphasis**: when the local user's slot is on the clock — app-bar pill border, clock-panel border, and a banner all go gold; green is used for the on-the-clock status of *any* team; gold is reserved for *you*.
- **Animations** (TV mode): split-flap stagger, splash card spring-in, 24s ticker loop, 1.4–1.6s opacity pulse on live dots. Respect `prefers-reduced-motion`.
- **Responsive**: the prototype is desktop-first; the intended phone layouts (single-column Desk with horizontal round strip, horizontally-scrolling Wall with sticky round rail, Locker Room as team tabs) are demonstrated in the included exploration file `Draft Board Explorations v2 (Dark).dc.html` inside iPhone frames. Hit targets ≥ 44px on mobile.

## State Management
Core state (single source of truth, will live in the draft engine/server in production):
- `teamCount` (6–14), `format` ('snake' | 'linear' | 'auction'), `drafted` (ordered array of player ids — index = overall pick number; this one array derives EVERYTHING: board cells, rosters, budgets, ticker, current round, on-the-clock team).
- `queueIds` (user's starred players, ordered), `selected` (player id for the card overlay or null).
- UI-local: active tab, board view ('wall' | 'locker'), two search strings, two position filters, hideDrafted flag.
- Derived helpers: `slotOf(overall) = snake ? (round odd ? reversed : normal) : normal`; tier from ADP; team needs = count picks per position; auction budget = 200 − Σ player prices.
- Data fetching: player pool (names, position, NFL team, bye, ADP, projection, auction value) from your data source; the prototype generates a 240-player sample.

## Design Tokens
### Colors
| Token | Value | Use |
|---|---|---|
| Void | `#0B0E13` | page ground |
| Stage | `#07090C` | TV mode ground |
| Raised | `#0E1218` | app bar, board grounds, tier headers |
| Panel | `#12161D` | section panels |
| Card | `#161B23` | cards, inputs, chips |
| Card-high | `#1A2029` | rows inside panels |
| Borders | `#1C232C` / `#222933` / `#242C37` / `#2A323D` / `#39424F` | elevation-matched hairlines |
| Text primary | `#ECEEF1` | |
| Text secondary | `#9AA3AE` / `#B6BEC9` | |
| Text tertiary | `#707A87` / `#5C6470` / `#3E4650` | metadata, disabled |
| **Clock Orange** | `#FB5A2D` | brand, CTAs, active states ONLY |
| **Live Green** | `#2FC76D` | "on the clock" status ONLY |
| **Your Gold** | `#D9A53F` | local user highlights + auction $ ONLY |
| Danger (stop) | `#A93E26` | AUTO-running state |

### Position key (the only other color on the board)
Six hues, fixed chroma, in OKLCH. For each position: **badge** (solid), **tint** (cell/row bg), **subtext** (light text on tint).
| Pos | Badge | Tint | Subtext | Badge text |
|---|---|---|---|---|
| QB | `oklch(0.62 0.14 30)` | `oklch(0.26 0.04 30)` | `oklch(0.72 0.06 30)` | white |
| RB | `oklch(0.62 0.14 150)` | `oklch(0.26 0.04 150)` | `oklch(0.72 0.06 150)` | white |
| WR | `oklch(0.62 0.14 250)` | `oklch(0.26 0.04 250)` | `oklch(0.72 0.06 250)` | white |
| TE | `oklch(0.66 0.13 75)` | `oklch(0.27 0.05 75)` | `oklch(0.74 0.07 75)` | `#1A1407` |
| K | `oklch(0.62 0.14 310)` | `oklch(0.26 0.04 310)` | `oklch(0.72 0.06 310)` | white |
| DST | `oklch(0.62 0.14 200)` | `oklch(0.26 0.04 200)` | `oklch(0.72 0.06 200)` | white |

Light mode (future): keep the same six hues and accent rules; lift the elevation steps (void/panel/card) to light neutrals and swap tints to ~`oklch(0.93 0.035 H)`.

### Typography
- **Archivo** 700–800 — headlines, team names, timers, wordmark. Tight letter-spacing (−0.3 to −2px at large sizes).
- **Barlow Condensed** 400–700 — player names, buttons, tabs, labels (dense board duty). Buttons/labels use letter-spacing 1–2px, uppercase.
- **IBM Plex Mono** 400–700 — ALL numbers and metadata (ADP, pick numbers, bylines, microlabels). Microlabels: 9–11px, letter-spacing 1.5–3px, uppercase.
- Scale used: 9 / 10 / 11 / 12.5 / 13.5 / 15 / 19 / 21 / 27 / 30 / 38 / 46 / 56px.
- Google Fonts: Archivo (500–800), Barlow Condensed (400–700), IBM Plex Mono (400/500/700).

### Spacing & shape
- Radii: 3px (badges), 5–8px (rows, buttons, inputs, chips at 999px), 12px (panels), 14–16px (overlays, TV stage).
- Gaps: 4px board cells, 5–7px list rows, 14px panel gutters, 24px page padding.
- Shadows: minimal — overlays `0 30px 70px rgba(0,0,0,0.7)`; TV inset glow; tiles `0 2px 0 rgba(0,0,0,0.7)`.

### Animation timings
- `flapIn`: rotateX 95°→0, 0.4s, 50ms stagger per tile.
- `splashIn`: scale 0.85 + 14px rise → none, 0.55s, `cubic-bezier(0.2, 0.9, 0.3, 1.2)`.
- `pulseDot`: opacity 1→0.15→1, 1.4–1.6s infinite.
- `marqueeX`: translateX 0→−50%, 24s linear infinite (duplicate content 2× for seamless loop).

## Assets
- No image assets. Team avatars are solid-color circles with 2-letter initials (colors in the `AV` array in the logic; the local user is always gold `#D9A53F`). Player photos are not in scope yet; the exploration files show placeholder treatment for future card designs.
- Fonts from Google Fonts (see Typography).

## Files
- `Draft Room v3 (Unified).dc.html` — **the deliverable.** All four tabs, pick strip, player card overlay, full state logic.
- `Draft Board Explorations v2 (Dark).dc.html` — context: the four board concepts + six player-card treatments (Hero Card, Stat Back, Pick Ticket, Board Sticker, Queue Row, Scouting Sheet) in this palette, **including the phone layouts for each board** — use these when implementing mobile.
- `Draft Board Explorations.dc.html` — earlier vintage-styled exploration (superseded; visual history only).
- `ios-frame.jsx` — iPhone frame used by the exploration files for phone mockups (not part of the design).

Note: the `.dc.html` files use a small custom template runtime (`{{ }}` holes, `<sc-for>`/`<sc-if>`); read them as "markup + a plain React-style class component". All styles are inline on the elements, so every value above can be verified directly in the markup.

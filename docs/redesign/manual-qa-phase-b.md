# Manual QA — Phase B (draft room)

Run `npm run dev`, open the app, click **Mock → Start mock**. (Fonts load
correctly from the main checkout; a worktree dev server 403s the woff2s — that's
a known harness artifact, not a regression.)

## B1 — Draft-room shell

The shell is the global frame; tab build-outs come in later stories. Verify the
frame and that nothing underneath broke.

### Frame

- [ ] App bar: "On The Clock." wordmark + "MOCK DRAFT" microlabel (left).
- [ ] On-the-clock **pill** (center) shows the team avatar, "● ON THE CLOCK",
      team name + pick number.
- [ ] Pill border + status turn **gold** only when it's _your_ slot on the clock;
      green for any other team.
- [ ] Right side: live **timer** (only during your turn) + status line
      "R# · PICK n OF N".
- [ ] Tab row PLAYERS / DRAFT / BOARD / TV MODE; active tab is white with a 3px
      orange underline. Default tab on entry is **DRAFT**.

### Tabs

- [ ] **PLAYERS** → research pool (filters + list), no clock controls.
- [ ] **DRAFT** → banner + your roster + pool (the working screen).
- [ ] **BOARD** → the draft grid.
- [ ] **TV MODE** → "Coming soon" placeholder (real view is B9).
- [ ] Bottom **pick strip** stays visible on every tab.

### Preserved behaviors (the whole point of B1)

- [ ] **Reveal**: when you go on the clock, the pill goes gold and the DRAFT-tab
      reveal plays; the clock holds ~1.5s before counting.
- [ ] **Sounds**: a ping plays as you go on the clock (unless muted via the 🔊
      control); mute toggle still works.
- [ ] **Pause**: ⏸ Pause freezes the draft (pick number stops advancing);
      ▶ Resume continues.
- [ ] **Undo**: Undo removes the last pick (pick number decrements) and pauses.
- [ ] **Replace-pick**: click a completed pick in the strip/board → menu →
      "Replace with…" → pick a player → that slot updates everywhere.

## B2 — Player card overlay

- [ ] Click a player name (pool/strip/board) → centered card with a 3px
      position-color border opens.
- [ ] Card shows ADP, PROJ (or `—`), VALUE (`—` in mock), and a status strip:
      green "✓ STILL AVAILABLE" or "DRAFTED x.xx · TEAM".
- [ ] Closes on ✕, scrim click, and Escape.

## B3 — Pick strip

- [ ] Clicking a completed pick in the bottom strip opens the **player card**.
- [ ] The on-the-clock card shows a gold dashed look + green "ON THE CLOCK".
- [ ] Your own picks have gold pick numbers + a gold-tinted border.

## B4 — Players tab

- [ ] PLAYERS tab shows already-drafted players inline, dimmed (~40%), with
      "pick · initials" instead of a DRAFT button.
- [ ] DRAFT tab still shows **available-only** players (no dimmed rows).

## B5 — My Queue

- [ ] Star (☆→★) a player in the pool → it appears in the **My Queue** panel
      (DRAFT tab), in star order.
- [ ] Draft a queued player (anywhere) → it **auto-drops** from the queue.
- [ ] DRAFT and ✕ remove work from the panel; empty state prompts to star.

## B7 — The Wall

- [ ] BOARD tab → THE WALL: left rail shows round numbers + direction arrows;
      arrows follow the **real** order (flip correctly under 3rd-round reversal).
- [ ] Your column has a gold outline; current pick cell is gold-dashed with
      green "ON THE CLOCK".
- [ ] Clicking a filled Wall cell still opens the **edit menu**
      (replace/undo/resume) — this is the replace-pick path; verify it works.

## B8 — Locker Room

- [ ] BOARD tab → toggle **THE WALL / LOCKER ROOM** (active pill orange).
- [ ] LOCKER ROOM: one column per team, each with a header, that team's picks
      as mini cards, and a needs footer ("QB1 · RB2 · …") that reflects picks.

### Known cosmetic carry-forwards

- Team name appears in **both** the app-bar pill and the DRAFT-tab banner —
  resolved by B6 (Broadcast Desk replaces the banner).
- **Replace-pick** is reachable only from the **Board-tab** Wall cell click (the
  strip now opens the player card). The spec's "Wall click → player card" is
  deferred until the sim-edit menu gets a dedicated affordance (decide at B6).
- B4's **HIDE DRAFTED** toggle (spec'd on the Players toolbar) is not yet wired.

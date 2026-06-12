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

### Known cosmetic carry-forward

- Team name appears in **both** the app-bar pill and the DRAFT-tab banner. This
  is resolved by B6, which replaces the banner with the Broadcast Desk.

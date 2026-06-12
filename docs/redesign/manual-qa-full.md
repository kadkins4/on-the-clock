# Manual QA — full redesign walkthrough (A1 → B10)

Everything below is on local `main` (**unpushed**). This is the single
end-to-end human-QA pass: go top to bottom, check each box when it looks/behaves
right, and jot any bug / question / improvement next to anything that's off.

## Setup

1. `npm run dev`, open the printed `localhost` URL.
2. Keep DevTools **Console** open — it should stay free of errors the whole way.
3. Two parts: **Part 1** is the home research board (A1–A6); **Part 2** is the
   draft room (B1–B10), reached via **Mock Draft → Start mock**.

> Font note: fonts must load from **localhost** (self-hosted). If you ever run a
> build from a git _worktree_ you may see woff2 403s — that's a tooling quirk,
> not a regression. From `npm run dev` on the main checkout they load fine.

---

# Part 1 — Home research board (A1–A6)

## A1 — Tokens & fonts

- [ ] Background is near-black (`#0b0e13`), panels slightly lighter.
- [ ] Network tab (filter `font`): every font is from **localhost**; **zero**
      `fonts.googleapis.com` / `fonts.gstatic.com` requests.
- [ ] Position labels use the new hues (QB red, RB green, WR blue, TE gold, etc.).

## A2 — Header / wordmark

- [ ] Wordmark reads **“On The Clock.”** with **“Clock.”** in orange (Archivo),
      on the raised header band; mono micro-label beneath it.
- [ ] `ABOUT` and `LOG` work; the brand/wordmark behaves as before.

## A3 — Table chrome

- [ ] Board sits in a rounded panel; mono micro-label column headers.
- [ ] Tier bands show an orange tick + “TIER N · _n_ players”.
- [ ] Drag a player by the handle to re-rank → order updates.
- [ ] Drag a tier break through players → re-tiers correctly.
- [ ] Mark a player drafted → row dims to ~40%.

## A4 — Toolbar

- [ ] Search: rounded dark field; typing filters; ✕ clears.
- [ ] Position chips are outlined pills; **QB** → only QBs + chip turns orange;
      **All** → full list.
- [ ] **HIDE DRAFTED** → turns orange (“✓ HIDING DRAFTED”), drafted vanish;
      again → return.
- [ ] `Bye`, `↩ Tiers`, `Clear filters`, `↺ Undo`, `⚙`, `⚙ Columns` all work.

## A5 — Notes column

- [ ] Each row shows a dim ✎ icon; click → card popover with a textarea.
- [ ] Type a note → icon turns **orange**; click-outside **or Esc** closes it.
- [ ] Reload → note persists, icon stays orange.
- [ ] `⚙ Columns` → hide/show Notes column works.

## A6 — Sort toggle

- [ ] **Tier | ADP** segmented toggle; **Tier** active (orange) by default.
- [ ] **ADP** → tier bands hide, list sorts ascending by ADP.
- [ ] **Tier** → bands reappear.
- [ ] In ADP mode, reload → still ADP (persists); switch to Tier, reload → Tier.

---

# Part 2 — Draft room (B1–B10)

Click **Mock Draft**, pick teams/slot, **Start mock**. The draft auto-runs; the
clock-panel **⏸ Pause** (on the DRAFT tab) freezes it whenever you want to look
around. Bots pick ~every second.

## B1 — Shell & global frame

- [ ] App bar: “On The Clock.” wordmark + “MOCK DRAFT” micro-label.
- [ ] On-the-clock **pill** (center): team avatar, “● ON THE CLOCK”, team + pick.
      Pill/status go **gold** only on _your_ turn; green for any other team.
- [ ] Tab row **PLAYERS / DRAFT / BOARD / TV MODE**; active = white + orange
      underline. Default tab is **DRAFT**.
- [ ] Bottom **pick strip** is visible and stays put across tabs.

## B2 — Player card

- [ ] Click any player name (pool / strip / board cell) → centered card with a
      3px position-color border.
- [ ] Card shows ADP, PROJ (or `—`), VALUE (`—` in mock) and a status strip:
      green “✓ STILL AVAILABLE” or “DRAFTED x.xx · TEAM”.
- [ ] Closes on ✕, scrim click, and **Esc**.

## B3 — Pick strip

- [ ] Clicking a **completed** pick in the bottom strip opens the **player card**.
- [ ] Current pick = gold dashed + green “ON THE CLOCK”.
- [ ] Your own picks have gold pick numbers + a gold-tinted border.

## B4 — Players tab

- [ ] **PLAYERS** tab shows drafted players inline, **dimmed (~40%)**, with
      “pick · TEAM” instead of a DRAFT ＋.
- [ ] **DRAFT** tab’s Best Available stays **available-only** (no dimmed rows).

## B5 — My Queue

- [ ] Star a player (☆→★) in a pool → it appears in **My Queue** (DRAFT tab) in
      star order.
- [ ] Draft a queued player (from anywhere) → it **auto-drops** from the queue.
- [ ] Panel’s **DRAFT** and **✕** work; empty state prompts to star.

## B6 — Draft tab (Broadcast Desk)

- [ ] DRAFT tab is a 3-column desk: **left** = clock panel (reveal + team + big
      timer + controls) → My Queue → My Roster; **center** = Best Available;
      **right** = “Round N” strip.
- [ ] My Roster header shows **gold needs** that shrink as you draft (e.g. RB2→RB1).
- [ ] Round strip: current pick gold-dashed + green “ON THE CLOCK”; done picks
      show the player; future show “—”.
- [ ] App-bar timer is **hidden on DRAFT** (the desk clock owns it); it returns
      on PLAYERS / BOARD / TV MODE.
- [ ] **Preserved controls all work from the desk clock panel**: ⏸ Pause /
      ▶ Resume, **Undo**, 🔊 mute, ⚙ pick-clock duration, **Exit**, and the
      on-the-clock reveal animation on your turn.

## B7 — Board: The Wall

- [ ] **BOARD** tab → **THE WALL**: left rail shows round numbers + direction
      arrows; arrows follow the real order (flip under 3rd-round reversal if you
      enabled it in setup).
- [ ] Your column has a gold outline; current cell gold-dashed + green label.
- [ ] Clicking a filled Wall cell opens the **edit menu** (Resume-from-here /
      Undo / **Replace with…**) — verify a replace swaps the player everywhere.
      _(This is the only place replace-pick lives now — see notes.)_

## B8 — Board: Locker Room

- [ ] BOARD tab toggle **THE WALL / LOCKER ROOM** (active pill orange).
- [ ] LOCKER ROOM: one column per team — header, that team’s picks as mini
      cards, and a needs footer (“QB1 · RB2 · …”) reflecting their picks.

## B9 — TV mode (static) + second window

- [ ] **TV MODE** tab: near-black stage — LIVE header with the on-clock team,
      “THE BIG BOARD.”, a split-flap row per current-round pick (surname in
      letter tiles), latest-pick splash, **UP NEXT** rail, bottom ticker.
- [ ] Click **⧉ Open TV Window** → a second window opens showing the same cast
      view (chrome-less).
- [ ] In the **main** window, draft / let bots pick → the **TV window mirrors
      live** (new picks, splash, ticker update). It’s **read-only** (no controls).
- [ ] Open the TV window while the draft sits **paused/idle** → it still shows the
      current board (not stuck on “Waiting…”).

## B10 — TV mode (motion)

- [ ] When a new pick lands, its split-flap tiles **flip in** left-to-right
      (staggered); the latest-pick splash **springs in**; the bottom ticker
      **scrolls** continuously; the LIVE dot **pulses**.
- [ ] Turn on OS **Reduce Motion** (macOS: System Settings → Accessibility →
      Display → Reduce Motion) and reload the TV view → **no animations**; the
      ticker becomes a static/scrollable row (nothing clipped or jumping).

---

## Cross-cutting

- [ ] Console stays free of errors throughout.
- [ ] Enter a mock draft and exit back to the home board → home state intact.
- [ ] Resize the window narrower → desk/board/TV degrade reasonably (mobile
      passes are **B11**, not done yet — major reflow there is expected).

## Known/deferred items (already flagged — not bugs)

- **About page title** still system-ui, not the Archivo wordmark (tokens-only
  follow-up).
- **`↩ Tiers` toolbar button** is partly redundant with the A6 Tier toggle; its
  active state uses near-black-on-orange vs white elsewhere.
- **Replace-pick** lives only on the **Board → Wall** cell click (the strip and
  board both used to open it; the strip now opens the player card per spec). If
  that feels hidden, it’s a known trade-off — flag your preference.
- **HIDE DRAFTED** toggle from the spec’s Players toolbar isn’t wired in the
  draft room yet.
- **VALUE / VOR** and most **PROJ** show `—` in the mock (real data deferred).
- The B6 clock panel reuses the existing banner stacked vertically rather than
  the spec’s bespoke 46px-timer card (visual polish deferred).
- **B11+ mobile** layouts are not built yet.

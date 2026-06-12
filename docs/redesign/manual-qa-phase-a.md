# Manual QA — Phase A (home research board redesign, A1–A6)

All of Phase A is on `main` (unpushed). This is the human-review checklist before
you push. Run `npm run dev`, open the home board, and walk these in order.
Check the box when it looks/behaves right; note anything off.

Tip: open DevTools → Network and filter `font` for step A1, and DevTools →
Console (should stay empty of errors throughout).

## A1 — Tokens & fonts

- [ ] Page background is near-black (`--void`, #0b0e13), panels a touch lighter.
- [ ] Network tab: every font is served from **localhost** (self-hosted woff2),
      **zero** requests to `fonts.googleapis.com` / `fonts.gstatic.com`.
- [ ] Position labels use the new hues (RB green, WR blue, QB, TE, etc.).

## A2 — Header / wordmark

- [ ] Wordmark reads **“On The Clock.”** with **“Clock.”** in orange, large
      Archivo, on the raised header band.
- [ ] Mono micro-label under it (“DRAFT DAY CHEAT SHEET”).
- [ ] `ABOUT` and `LOG` links work; clicking the wordmark/brand behaves as before.

## A3 — Table chrome

- [ ] Board sits in a rounded panel; columns have mono micro-label headers.
- [ ] Tier bands show an orange tick + “TIER N · _n_ players”.
- [ ] **Drag a player** by the ⠷ handle to re-rank → order updates, drag works.
- [ ] **Drag a tier break** (⠿) through players → re-tiers correctly.
- [ ] Mark a player **drafted** (the draft cell) → row dims to ~40%.
- [ ] Zebra striping is visible but subtle; nothing overlaps or clips.

## A4 — Toolbar

- [ ] Search box: rounded rect, dark card fill, condensed font; type a name →
      list filters; the ✕ clears it.
- [ ] Position chips are outlined pills; click **QB** → only QBs show and the
      chip turns **orange**; click **All** → full list returns.
- [ ] **HIDE DRAFTED** button: click → turns orange, label becomes
      “✓ HIDING DRAFTED”, drafted players disappear; click again → they return.
- [ ] `Bye`, `↩ Tiers`, `Clear filters`, `↺ Undo`, `⚙`, `⚙ Columns` all still work.

## A5 — Notes column

- [ ] Every row in the **Notes** column shows a dim ✎ icon (no inline input).
- [ ] Click a ✎ → a card popover opens below it with a textarea.
- [ ] Type a note → icon turns **orange** (has-note); click outside **or** press
      **Esc** → popover closes.
- [ ] Reload the page → the note persists and its icon stays orange.
- [ ] Open `⚙ Columns` → hide the Notes column → it disappears; show it → returns.

## A6 — Sort toggle

- [ ] Toolbar shows a **Tier | ADP** segmented toggle; **Tier** is active
      (orange) by default and tier bands are visible.
- [ ] Click **ADP** → tier bands disappear, list re-sorts ascending by ADP
      (smallest ADP at top), ADP segment turns orange.
- [ ] Click **Tier** → bands reappear in their groupings.
- [ ] In ADP mode, **reload** → still ADP-sorted with bands hidden (persists).
- [ ] Switch back to Tier, reload → Tier mode restored.

## Cross-cutting

- [ ] Console has **no errors/warnings** across all of the above.
- [ ] Enter a **mock draft** and back → home board state intact; nothing regressed.

---

### Known cosmetic items (already flagged, not blockers)

- **About page title** still renders in system-ui ~17.5px, not the Archivo
  wordmark (InfoPage `.otc-page-title` was out of A2 scope). Candidate for a
  small tokens-only pass.
- **`↩ Tiers` vs the new `Tier` toggle** are now partly redundant (both return to
  tier view). Consider removing/merging `↩ Tiers` into the A6 toggle later.
- **`↩ Tiers` active state** uses near-black text on orange while chips / HIDE
  DRAFTED / the sort toggle use white — minor inconsistency to harmonize.

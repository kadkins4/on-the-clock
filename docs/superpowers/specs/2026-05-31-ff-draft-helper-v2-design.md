# FF Draft Helper v2 — Design

**Date:** 2026-05-31
**Status:** Approved (brainstorming), pending implementation plan
**Author:** Kendall + Claude

## Goal

Turn the personal `ff-cheat-sheet` tool into an app Kendall can rely on across his **5 fantasy leagues** (3 of them "big" drafts), and that a handful of **friends** can try and give feedback on. The validated user is Kendall himself — he currently pays for FantasyPros, Fantasy Flock, and another tool, and none bend their tier boards to his view the way he wants.

**Primary wedge (already shipped in v1): fast, fully-editable tier boards.** Everything else in this design exists to make that wedge reliable, multi-league, and usable on draft day.

**Not a product play this year.** Money is a _possible_ last step if friends validate it; it is explicitly out of scope for v1. The honest framing: build the tool Kendall needs, share it for feedback, decide on monetization later.

### Season constraint

Fantasy drafts cluster late-August → mid-September. Kendall has 3 big drafts he will not enter without having tested the app via mock drafts. Target: usable engine well before draft season so mock drafting can happen in advance. Runway is ~10 weeks of evenings/weekends against a ~10-week build — tight, eyes-open.

## Decisions locked during brainstorming

- **Approach: local-first + cloud backup.** `localStorage` stays the primary store; the draft never depends on the network. Supabase is a background mirror.
- **Auth:** Supabase magic-link email, invite-only. No public signup in v1.
- **Sequencing:** build the presentation-agnostic _engine_ on the existing desktop/web surface first (Phase 1–4), then a **committed** mobile-presentation phase before draft day (Phase 5). Mobile is scheduled, not optional — the phone is the draft-day device.
- **ADP sources v1:** ESPN + Sleeper (both free, no-auth). **Yahoo → v1.5** (requires per-user OAuth). **Underdog → v1.5** (no API; fragile scrape). **"Vegas" → deferred** (no clean free path; it's prop lines → projections, not ADP).
- **Mock drafts:** snake only (+ optional 3rd-round reversal). Fully tunable. Depth-scaled bot variance. Optional, previewable writeback to the real board.
- **IDP → v1.5.** Roster model stays _extensible_ for IDP slots, but no IDP data/logic in v1.
- **Launch ugly, polish on signal.** Mobile _structure_ (card layout, thumb ergonomics) is functional, not polish, and must be right at v1. Visual polish (color, type, brand, animation) is deferred until friends give signal.

## Architecture

Three layered shifts over the current React 19 + TS + Vite + dnd-kit + Vitest app:

1. **Local-first remains primary.** `localStorage` is the source of truth at the browser level. The board works fully offline; the draft is never in the network critical path.
2. **Supabase = background sync layer.** Magic-link auth, Postgres (board stored as JSON per league), Row-Level Security so each user only sees their own data.
3. **Mobile-first presentation (Phase 5).** Same data layer; presentation forks — desktop keeps the dense table, mobile gets a card stack. Engine is built once and reused.

**Friends-as-feedback:** invite-only magic link. Each friend gets isolated boards. No multiplayer, no shared draft room (that's the deferred Live Tracker).

### Stack additions

- **Supabase** — auth + Postgres + JS client (free tier ample).
- **vite-plugin-pwa** — installable mobile, offline, home-screen icon.
- **One serverless proxy** (`/api/adp`, Supabase Edge Function or Vercel route) — browser can't call Sleeper/Yahoo directly (CORS / secrets); the proxy fans out server-side and returns normalized ADP. Keeps the backend boring and keeps any future Yahoo secret off the client.
- Hosting: Vercel (already used for the portfolio).

### Explicit non-goals (v1)

Public signup / marketing / monetization; real-time cross-device sync _during_ a single draft; live shared draft rooms; auction drafts; Yahoo, Underdog, "Vegas", IDP; multi-source sync living inside Supabase (ADP merge is client-side at fetch time).

## Data model

The **League** becomes the top-level object; a board belongs to a league.

```
User (Supabase auth)
 └─ Leagues[]
      ├─ id, name              e.g. "Money League (ESPN)"
      ├─ platform              espn | yahoo | sleeper | underdog | other
      ├─ scoring               ppr | half | standard  (+ tePremium toggle)
      ├─ teams                 8–16
      ├─ rosterSettings        QB/RB/WR/TE/FLEX/SUPERFLEX/K/DST counts,
      │                        bench, per-position enable/disable,
      │                        IDP-ready slots (DL/LB/DB) — extensible, unused v1
      ├─ board                 Player[]   ← today's tier-list model
      └─ updatedAt             (sync granularity / LWW)

Player (per board; today's shape extended)
 ├─ id, name, position, team, bye
 ├─ tier, overallRank         (user-controlled)
 ├─ drafted, mine, target, avoid, notes
 ├─ injuryStatus
 └─ adp: { espn?, sleeper?, blended }   ← per-source + computed

MockDraft (mostly ephemeral, per league)
 ├─ leagueId, settings (see Mock section)
 ├─ order, currentPick
 └─ results[]                 (lightweight summary persisted; not the live board)
```

**Key decisions:**

- **ADP is per-source + a blended number.** Blended = average of available sources, scoring-weighted where the source supports it. Single-source players → blended = that source. Board sorts/defaults on `blended`.
- **Scoring lives on the League, not global.** Switching leagues re-derives blended ADP + default tier order; manual tier edits persist _per league_ (boards are per-league, so Dynasty tiers never bleed into Money League).
- **Migration:** today's `ff-cheat-sheet:lists:v1` named lists map cleanly to Leagues (default scoring guess = PPR, user-correctable). No data loss.
- **Sync granularity = a League** (board + settings). Last-write-wins per league by `updatedAt`. Separate leagues never clobber each other.
- **Mock reads a league's board + roster settings, runs in memory.** Marking players drafted is mock-only and non-destructive. Optional end-of-mock **previewable diff** writeback to the real board (explicit confirm; cannot silently clobber prep).

## Sync & offline behavior (reliability core)

**Guarantee:** the draft never depends on the network. Reads/writes hit `localStorage` first, synchronously. Sync is a background mirror, never in the critical path.

**Write path:** edit → `localStorage` updates immediately, UI re-renders (zero latency) → debounced (~2s) background push to Supabase → on failure, queue + retry, user sees nothing and loses nothing. Sync indicator: `Synced ✓` / `Saving…` / `Offline — saved locally`.

**Read path (new device / app open):** boot from `localStorage` instantly → background pull → per league compare `updatedAt` → cloud newer updates local; local newer pushes up; equal no-op.

**Conflict handling:** last-write-wins per league by `updatedAt`. Genuine conflict (cloud newer AND local has unsynced changes) → keep both; loser saved as `"<league> (conflict copy)"`. No silent data loss.

**Offline at the draft:** PWA loads with no network; draft runs entirely against `localStorage`; queued writes flush when network returns; if it never returns during the draft, it doesn't matter (all local, exports work).

**Deliberate non-goal:** no real-time cross-device sync _during_ a single draft. One device of record per draft (Kendall drafts on one device — phone on a stand).

**Reliability test suite (proven in Phase 3):** airplane-mode (edit offline → persist → re-enable → flush), two-device sequential edit, conflict-copy, hard-refresh-mid-edit. Scripted, run before trusting a real draft.

## Multi-source ADP

| Source   | How                                           | Auth     | Risk               | Version  |
| -------- | --------------------------------------------- | -------- | ------------------ | -------- |
| ESPN     | `kona_player_info`, CORS open (already wired) | none     | low                | v1       |
| Sleeper  | public API via proxy (CORS)                   | none     | low                | v1       |
| Yahoo    | Fantasy API via OAuth2 proxy                  | per-user | medium             | v1.5     |
| Underdog | no API; scrape                                | none     | high (fragile)     | v1.5     |
| "Vegas"  | prop lines → projections, not ADP             | —        | no clean free path | deferred |

- **`/api/adp` edge function** fans out to enabled sources, normalizes to `{playerId, source, adp}`, returns merged payload. Client blends per league scoring and merges into the board preserving tiers/flags (same merge logic as today's "Fetch players").
- **Why a proxy:** ESPN reflects origin (direct browser call OK), but Sleeper/Yahoo block CORS or need secrets. Source slots are stubbed so adding Yahoo/Underdog later is one more fan-out, not a rewrite.
- **Blending:** weighted average of available sources; PPR-aware sources weighted higher in PPR/half leagues; missing-source players use what's available. Blended shown in the ADP column; per-source breakdown in the expanded card / desktop hover.
- **Identity matching** (the gnarly 20%): normalized-name + position + team, with manual-override fallback for non-matches (e.g. "Marquise" vs "Hollywood" Brown).

## Mock-draft engine

**Loop:** pick a league (pulls board, scoring, teams, roster) → set draft slot + order → draft runs (your pick = tap from your live tier board in mock mode; bot picks auto-select) → board updates live (strike-through, positional counts, re-rank) → end summary (roster, reach/value vs blended ADP, positional balance) → optional previewable writeback diff.

**Settings (fully tunable):**

- **Teams:** any 8–16.
- **Draft type:** snake; optional 3rd-round reversal (3RR) toggle. (Auction deferred.)
- **Scoring:** PPR / half / standard, + TE-premium toggle.
- **Roster construction:** QB/RB/WR/TE/FLEX/SUPERFLEX/K/DST counts, bench size, per-position enable/disable. IDP slots extensible but off in v1.
- **Pick timer:** 30s / 1min / 2min / none. On timeout: auto-pick top-available (default) or pause (toggle).
- **Session:** pause/resume, undo last pick, restart.

**Bot behavior:**

- **Depth-scaled variance** (key ask): bots pick from a probability-weighted window of best-available, _tight_ in round 1 (near-deterministic), _widening_ with round depth — so 10 mocks produce 10 different boards, round-1 mostly stable, spread growing each round.
- **Roster-need weighting:** favor filling open required slots, composed with the variance window.
- **Light run-chasing:** bots lean into position runs for realism.

**Cut lines if runway slips (in order):** drop run-chasing → drop writeback diff (plain "no writeback") → simplify conflict-copy to plain LWW. Mobile and core mock stay — they're the point.

## Mobile-first UX (Phase 5)

**Two presentations, one data layer.**

- **Phone (primary): vertical card stack**, one card per player. Visible without tapping: rank #, name, position chip (RB2), team, bye, blended ADP, big **Draft** button. Tier dividers = full-width collapsible bars. Tap → expand for notes, per-source ADP, injury detail, target/avoid, tap-to-retier ("move to tier" / "new tier here" — no fiddly drag).
- **Desktop (≥ wide breakpoint):** today's table view, denser, drag-to-retier retained.

**Draft-day phone ergonomics (phone on stand, Kendall on laptop in the ESPN/Sleeper room):**

- One-thumb reach: Draft + "mark gone" in the lower 2/3 of the card.
- **#1 real-draft action = "mark who's gone, fast"** — first-class, low-friction, never buried.
- Sticky search + position filter chips; always-visible positional counts (`QB 5(1)`) + current tier.
- Big tap targets; clear pressed/drafted state.
- Mock "on the clock": turn/timer banner + board filtered to best-available; one-tap draft. Same card vocabulary as browse mode (learn one interface).

**Launch-ugly reconciliation:** mobile _structure_ is functional and must be right at v1; _visual_ polish is deferred.

## Phasing & rough timeline

Ordered so a mock-draftable engine arrives early and reliability is proven before any real draft. ~10 weeks of evenings/weekends — right at the runway edge.

- **Phase 0 — Foundation (~1 wk):** Supabase project, magic-link auth (self + invite a friend), schema + RLS, migrate named lists → Leagues.
- **Phase 1 — Leagues & scoring (~1 wk):** League CRUD (name, platform, scoring + TE-premium, 8–16 teams, roster settings incl. superflex / enable-disable / IDP-ready slots); board becomes per-league.
- **Phase 2 — Multi-source ADP (~1.5 wk):** `/api/adp` fanning ESPN + Sleeper, normalized + identity-matched; per-source storage + scoring-weighted blend; breakdown in expanded card.
- **Phase 3 — Local-first cloud sync (~1.5 wk):** debounced push, pull-on-load, LWW per league, conflict-copy, sync indicator; **reliability test suite proven here.**
- **Phase 4 — Mock-draft engine (~2 wk):** snake (+3RR), 8–16 teams, timers, full roster construction, depth-scaled variance + roster-need + run-chasing, end summary + writeback diff gate. **Mock-draftable on desktop from here.**
- **Phase 5 — Mobile presentation (~2 wk):** card stack, thumb ergonomics, sticky search/filter/status, tap-to-retier, on-the-clock screen, PWA + offline.
- **Phase 6 — Friends + buffer (~1 wk):** invite flow, lightweight feedback capture, bug-fix buffer.

## Out of scope (v1.5+)

Yahoo, Underdog, "Vegas" projections, IDP, auction drafts, real-time shared draft rooms, public signup / marketing, monetization.

## Open follow-ups

- Confirm scoring-weight specifics for blended ADP (how much extra weight PPR-aware sources get in PPR/half leagues).
- Identity-matching override UX for the handful of unmatched players.
- Feedback-capture mechanism for friends (in-app vs. external form) — decide in Phase 6.

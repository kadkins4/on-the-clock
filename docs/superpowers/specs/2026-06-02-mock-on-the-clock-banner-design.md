# Mock-draft "On The Clock" banner + on-the-clock moment

**Date:** 2026-06-02
**Status:** Approved (via live mockup iteration)

## Goal

Make the mock-draft banner announce the user's turn with a branded, animated
"On The Clock" moment — a typewriter reveal, a glow, and a bell — and make the
per-player Draft action easier to find. Placeholder polish; the full mock-draft
restyle comes later.

## Banner redesign (`OnTheClockBanner` + `MockDraft` status)

Two-line status block, left-aligned:

- **Line 1 (always):** `You are now…`
- **Line 2 (dynamic), completes the sentence:**
  - **Waiting:** `N picks away` (muted gray). `N` is the real count of picks
    until the user's next turn, derived from the snake order. Singular: `1 pick away`.
  - **On the clock:** types out `On The Clock.` splash-style (gray "On The", orange
    "Clock", gray "."), finishing with a one-shot glow pulse (scale 1→1.08→1 +
    soft orange text-shadow, ~550ms). Wordmark at homepage size (1.6rem / 800).
  - **Complete:** `Draft complete` (line 1 hidden). **Paused:** unchanged minimal text.

**Timer:** large (~2.6rem, tabular-nums), top-right, right-justified. Pick info
(`R1 · Pick 1 of 180`) small beneath it. The existing duration `<select>` is kept
but secondary (small, under the timer).

**Controls row:** Pause / Undo / Exit / **mute**. No Draft button in the banner.

## The on-the-clock moment (the 1.5s reveal)

When the user transitions onto the clock (`isUser` flips true for a new pick):

1. Bell plays (unless muted).
2. Line 2 types `On The Clock.` (~1.3s) then glows.
3. For **1.5s** from clock-in, the turn is **locked**: the countdown timer does
   not start and **all Draft actions are disabled** (per-player buttons and the
   Draft-board grid). After 1.5s the timer starts and Draft unlocks.

Implemented as a `revealing` flag in `MockDraft`, true for 1.5s after each new
user pick. Timer countdown and auto-pick-on-timeout are gated on `!revealing`.

## Sound (`src/lib/sound.ts`)

`playPing()` — a synthesized Web-Audio bell (three sine partials 880/1760/2640 Hz,
quick exponential decay). Single call site so the real sound file can swap in
later. AudioContext is created/resumed on a user gesture (Start mock / first
interaction) to satisfy autoplay rules; once resumed it stays unlocked for
timer-driven plays. No-ops when muted or if Web Audio is unavailable.

## Mute

A 🔊/🔇 toggle in the banner controls, persisted in `localStorage` (`otc:muted`).
Read on mount, written on change. Gates `playPing()`.

## Per-player Draft button

- **Move to the left** of the player name (first cell in the row) so it's easy to
  scan who you're drafting.
- **Restyle** with the orange placeholder style (accent background, dark bold
  label) — matches the mockup. Same treatment applied for visual consistency
  where the Draft action appears.
- **Disabled** when `!isUser || revealing`.

## "Picks away" helper (`src/lib/mock/order.ts` or `board.ts`, TDD)

`picksUntilUser(state, userTeamIndex): number` — scans the snake `order` from the
current pick forward to the user's next slot; returns the gap (0 when on the
clock). Unit-tested alongside the existing mock-lib tests.

## Out of scope (later)

Draft-button click animation, full mock-draft restyle, custom sound file.

# Spec — TV Mode Draft Announcer (ElevenLabs spike)

**Branch:** `worktree-tts-announcer` · **Date:** 2026-07-23
**Baseline:** 623 tests / 84 files passing (handoff said 561 — repo grew since)

## Goal

Spoken pick announcements in **TV mode only**, using ElevenLabs TTS with a free
browser-voice fallback. This is a scoped spike whose second purpose is giving
Kenny a true answer to ElevenLabs' application question ("have you used it?").

Not a polished feature. Not shipping to prod with the key.

## Decisions (from brainstorming with Kenny, 2026-07-23)

| #   | Decision                                                                              | Rationale                                                                                                                        |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **TV mode only**, not general Mock Draft mode                                         | TV mode is the in-person-draft, everyone-watching case. That's where "epic" belongs.                                             |
| 2   | **Default off**, behind a toggle in the TV window                                     | Also required: the toggle _is_ the autoplay-unlock gesture (see Finding A).                                                      |
| 3   | ElevenLabs when a key is configured; **browser `speechSynthesis` fallback** otherwise | Prod ships without the key → public visitors get the free voice → zero credit burn from strangers, no shared-cache infra needed. |
| 4   | Line: **"With pick 17, running back Jahmyr Gibbs."**                                  | Kenny's pick. ~40 chars. Full name always (repo rule).                                                                           |
| 5   | **Announce every pick**, cache locally in IndexedDB                                   | Verified: 10k credits/mo, 1 char = 1 credit → 250 announcements/mo → ~1.4 uncached mocks. Cache is load-bearing, not a nicety.   |
| 6   | **Auto-draft announces nothing**                                                      | Kenny's call. Picks fire every 850ms there.                                                                                      |
| 7   | **Coalesce** — when picks outpace speech, skip to the most recent                     | Kenny's call. No backlog queue.                                                                                                  |
| 8   | Choreography: **announcement starts → name flips → next on clock**                    | Kenny's call. Implemented locally in the TV window (see Finding B).                                                              |
| 9   | **Flair lines** on big reach/value swings                                             | `draftValue.pickSignal()` already computes this.                                                                                 |

## Findings that contradict the handoff doc

### A. The autoplay problem is NOT already solved

The handoff claimed `unlockAudio()` had solved it. It hasn't — for TV mode.

`unlockAudio()` is called in `MockMode.tsx:38`, which runs in the **main
window**. The TV window (`#tv` hash, `main.tsx:27`) is a **separate browsing
context**: own document, own `AudioContext`, own autoplay-policy state. It has
received **zero user gestures** — `TVStage.tsx` has no `button`, no `onClick`,
nothing interactive.

**Consequence:** the TV window needs its own gesture. Decision 2's toggle
supplies it. One control, two problems solved.

**Corollary:** persisting "announcer on" to localStorage does _not_ survive the
autoplay policy — a fresh TV window still has no gesture. Require one click per
TV window session. Honest and simple.

### B. TV mode receives state snapshots, not pick events

`useTvBroadcast` posts a whole `TvSnapshot` on every state change. Diffing
consecutive snapshots to detect "a pick happened" breaks on:

- **undo** / **rewind** — `latest` changes backwards
- **replacePick** — `latest` changes with no forward progress
- **simulateToEnd** — fills the entire board in one message (~180 picks)

**Consequence:** add an explicit `announce` event to the channel protocol,
emitted from the main window only on **forward progress** (`picks.length ===
prev + 1`). Every failure mode above falls out for free.

### C. Flair data exists but isn't in the snapshot

`draftValue.pickSignal(adp, overall, threshold)` → `{kind: "reach"|"value",
amount}` is already used by `board.ts:59` and `summary.ts:35`. The ADP baseline
(`player.adp`) and threshold (`settings.valueThreshold`) both live in the main
window where `buildTvSnapshot` runs. Ride the signal along on the new event.

## Architecture

```
MAIN WINDOW                              TV WINDOW (#tv)
-----------                              ---------------
MockDraft.tsx
  useDraftTimer -> autoOn ------\
  useTvBroadcast(state, autoOn)  |
        |                        |
        | forward pick only,     |
        | autoOn suppressed      |
        v                        |
   {type:"announce", ...} --BroadcastChannel("otc-tv")-->  useAnnouncer
                                                              |
                                                     coalesce (drop stale)
                                                              |
                                                     phrase.ts (pure)
                                                              |
                                                     speak.ts
                                                       |         \
                                              cache.ts (IDB)   speechSynthesis
                                                       |          (fallback)
                                                  /api/tts
                                                       |
                                                  ElevenLabs
```

## Files

**New**

- `api/tts.ts` — edge function, mirrors `api/adp.ts`. POST `{text}` → `audio/mpeg`. Reads `ELEVENLABS_API_KEY` (unprefixed = server-only). Returns 503 when unset so the client falls back.
- `src/lib/announcer/phrase.ts` — pure sentence builder incl. flair. Fully unit-testable.
- `src/lib/announcer/cache.ts` — IndexedDB blob cache keyed by exact sentence.
- `src/lib/announcer/speak.ts` — ElevenLabs → cache → `speechSynthesis` fallback chain.
- `src/components/mock/useAnnouncer.ts` — coalescing + choreography (colocated hook, per repo convention).

**Modified**

- `src/lib/mock/tvSnapshot.ts` — add `TvAnnounce` + extend `TvMessage` union.
- `src/components/mock/useTvBroadcast.ts` — accept `autoOn`, emit forward-pick-only announce events.
- `src/components/mock/MockDraft.tsx` — pass `autoOn` through (one line).
- `src/components/mock/TvWindow.tsx` — mount the toggle + announcer.
- `vite.config.ts` — add `ttsDevApi()` plugin mirroring `adpDevApi()`.
- `.env.local.example` — add redacted `ELEVENLABS_API_KEY=`.
- `src/components/infoContent.tsx` — Change Log entry (repo rule).
- `README.md` — fix line 23 (see below).

**No new dependencies.** Plain `fetch` to ElevenLabs' REST API; repo keeps 9 deps.

## README correction (independent of this feature)

Line 23 claims _"Nothing leaves your browser."_ Already false today:
`@vercel/analytics` is mounted at `main.tsx:33`, `/api/adp` fans out to four
providers, and the suggestion box POSTs to Formspree. Line 96's formal Privacy
section is narrow, accurate, and unaffected by this work.

Fix line 23 to match line 96's real scope. This is a pre-existing bug, not a
cost of the announcer.

## Out of scope

- Shared server-side audio cache + rate limiting (see Future Work)
- Voice cloning, multi-voice, audio tuning beyond picking a stock voice
- Deploying with the key set
- Anything outside TV mode
- Cross-window timer pause (fallback only if choreography feels rushed)

## Future work (Kenny asked this be captured)

If the live public site should ever get the real ElevenLabs voice:

1. **Shared cache** — Vercel Blob or KV. Edge function checks the store for the
   exact sentence, returns the stored MP3, else generates and writes back.
   Player names repeat heavily, so a shared cache warms fast across all users.
2. **Rate limiting** — mandatory. Without it one person holding refresh drains
   the month.
3. **Pre-generated phrase bank** — the top ~200 player names plus positions and
   ordinals could be batch-generated once and shipped as static assets, making
   the common path free and network-less.
4. Paid tier if it ever needs a commercial license (free tier is
   non-commercial only — verified on the pricing page).

## Verification

- `./node_modules/.bin/vitest run` → 623 baseline tests still green, plus new ones
- `./node_modules/.bin/tsc --noEmit` clean
- Manual: open a mock, open the TV window, enable the announcer, confirm
  sequencing and the fallback voice with no key set

## Future work — recorded / cloned voice (Kenny asked 2026-07-23)

Kenny floated recording player names himself for the fallback voice. Clarified
2026-07-23: he means the **top ~100 player names only**, stitched into the rest
of the sentence — not whole sentences. **Deferred, not rejected** ("later
discussion"). Reasoning captured so it isn't relitigated:

- **Coverage cliff.** A 12-team x 15-round mock is 180 picks. Top 100 names
  still leaves ~80 picks (44%) on `speechSynthesis`, so the voice changes
  mid-draft regardless.
- **Mixed-voice seam is the real killer.** Recording only names means a
  synthetic voice says "With pick 17, running back" and Kenny's voice says
  "Jahmyr Gibbs" — audibly two different people mid-sentence. Reads as a bug.
  Fixing it means recording the carriers too: "With pick" + number words + 6
  positions + ~100 names, roughly **156 clips**, all one voice. Coherent, but a
  real session, and the seams become the ordinary concatenative-speech problem.
- **Roster churn** — the top 100 shifts every August; rookies and trades mean
  re-recording. TTS handles an unseen name for free.
- Does *not* shrink the ElevenLabs surface — this is the fallback path only, so
  the primary integration is untouched. (My earlier objection on this point was
  wrong; Kenny always framed it as the fallback.)

**Better versions, both deferred:**

1. **Flair stingers in Kenny's voice.** The reach/value lines are fixed strings
   (~10 clips). Complete standalone utterances, so no seams, no combinatorics,
   no roster churn. Cheap and charming. This is the good version of the idea.
2. **ElevenLabs voice cloning.** Record a few minutes once, get Kenny's voice on
   any name forever including unseen rookies. Solves coverage and stitching at
   once and makes the ElevenLabs story stronger. Out of scope per handoff, but
   it's the obvious phase two. (Unverified whether cloning is on the free tier.)

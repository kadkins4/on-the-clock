# T5 — Speak layer with fallback chain

**Blocks:** T6 · **Blocked by:** T3, T4 · **Est:** M

`src/lib/announcer/speak.ts` — resolve a sentence to audible speech:

1. Cache hit -> play the stored blob
2. Else POST `/api/tts` -> play + cache the result
3. Else (503, network error, no key) -> `window.speechSynthesis`

The fallback is the **normal production path**, not an error path. Prod ships
without the key.

- Must expose `cancel()` so T6 can coalesce (drop a stale announcement mid-speak).
- Reuse a single `Audio` element / `AudioContext` so the TV window's one unlock
  gesture keeps applying.
- Never throw into the caller. Silence is an acceptable failure.

TDD: inject the fetch and the synthesis handle. Cover all three tiers plus
cancel-mid-play.

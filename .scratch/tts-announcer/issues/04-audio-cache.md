# T4 — IndexedDB audio cache

**Blocks:** T5 · **Blocked by:** nothing · **Est:** M

`src/lib/announcer/cache.ts` — store generated MP3 blobs keyed by the **exact
sentence text**.

Load-bearing, not a nicety: verified 10k credits/mo at 1 char = 1 credit means
~250 announcements, and one 12x15 mock is 180 picks. Without the cache Kenny
gets ~1.4 mock drafts per month.

- `get(text): Promise<Blob | null>` / `put(text, blob): Promise<void>`
- Degrade to a no-op if IndexedDB is unavailable (jsdom, private browsing).
  Never throw into the announce path.
- Simple size cap so it can't grow unbounded.

TDD: fake-idb or a thin injectable adapter. Must cover the "IDB missing"
degradation path since that's what jsdom hits.

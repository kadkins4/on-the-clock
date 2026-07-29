# T6 — useAnnouncer hook (coalescing + choreography)

**Blocks:** T7 · **Blocked by:** T2, T5 · **Est:** L

`src/components/mock/useAnnouncer.ts` — colocated hook per repo convention
(heavy logic goes in hooks).

Subscribes to `announce` messages on the TV channel. Responsibilities:

**Coalescing** (Kenny: "skip to the most recent"): if an announcement arrives
while one is playing, `cancel()` the current and speak the newest. Never queue
a backlog.

**Choreography** (Kenny's sequencing): announcement starts -> *then* the name
flips -> *then* next on the clock. Implement **locally in the TV window** by
holding the incoming snapshot for a beat and releasing it once speech starts.
No cross-window timer pause — that stays a fallback if this feels rushed.

Returns `{ enabled, enable, speaking }` for T7.

TDD: fake timers. Cover coalescing under rapid picks, and that the held
snapshot releases when speech begins (and still releases if speech fails).

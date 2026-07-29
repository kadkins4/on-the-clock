# T2 — Announce event on the TV channel

**Blocks:** T6 · **Blocked by:** T1 · **Est:** M

Extend the channel protocol so the TV window gets pick *events*, not just state.

`src/lib/mock/tvSnapshot.ts`:
```ts
export interface TvAnnounce {
  overall: number; name: string; position: string;
  signal: PickSignal | null;
}
export type TvMessage =
  | { type: "snapshot"; snapshot: TvSnapshot }
  | { type: "request" }
  | { type: "announce"; announce: TvAnnounce };
```

`src/components/mock/useTvBroadcast.ts` — accept `autoOn: boolean`. Track
previous `picks.length` in a ref. Emit `announce` **only** when
`picks.length === prev + 1` (forward progress) **and** `!autoOn`.

This is the whole correctness story — it must NOT announce on:
- undo / rewind (length decreases)
- replacePick (length unchanged)
- simulateToEnd (length jumps by many)
- any pick while auto-draft is on

Compute `signal` via `pickSignal(player.adp, overall, settings.valueThreshold ??
defaultValueThreshold(teams))` — same call shape as `board.ts:56-59`.

`MockDraft.tsx:137` — pass `autoOn` through from `useDraftTimer`.

TDD: tests first, one per suppression case above. This is where bugs will live.

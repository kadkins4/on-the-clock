# T1 — Phrase builder (pure)

**Blocks:** T2, T6 · **Blocked by:** nothing · **Est:** S

Create `src/lib/announcer/phrase.ts`. Pure function, no I/O, no React.

```ts
buildAnnouncement(input: {
  overall: number; name: string; position: string;
  signal: PickSignal | null;
}): string
```

- Normal: `"With pick 17, running back Jahmyr Gibbs."`
- Expand position codes to spoken words (RB -> "running back", WR -> "wide
  receiver", TE -> "tight end", QB -> "quarterback", K -> "kicker",
  DEF -> "defense").
- **Full player name always** (repo rule). Never abbreviate.
- Flair when `signal` is present, appended: reach -> e.g. `"That's a big reach."`,
  value -> e.g. `"He was still on the board?"`. Keep short; every char is a credit.

TDD: tests first. Cover each position code, both signal kinds, null signal,
and that the full name survives.

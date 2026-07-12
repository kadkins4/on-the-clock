# Icon brief — "On The Clock" bot personalities

## The app (context)

**On The Clock** is a fantasy-football draft helper. One of its modes is a **mock draft**: you draft against 11 AI "bots," and each bot drafts with a distinct **strategy / personality** (e.g. one hoards running backs early, another chases rookies, another pairs a quarterback with his own receivers). Before the draft you can dial in the mix of bot personalities; after the draft, each bot's persona is revealed.

Visual identity: **dark UI** (near-black background ~`#0E1218`), condensed sporty display type, single warm-orange accent (`#FB5A2D`). Clean and modern, not cartoonish.

## What the icons are for

A small **glyph per strategy**, used in two places:

1. **Bot-mix picker** (draft setup) — icon + name + one-line description in a list row.
2. **End-of-draft reveal** — icon next to each bot's persona.

They currently use emoji; we want a **custom, cohesive icon set** instead.

## Constraints

- **Legible at 18px** (list size); also shown up to ~56px. Avoid fine detail that dies when small.
- **One cohesive family** — matching stroke weight, corner radius, optical sizing. Monoline / geometric line icons preferred (think Lucide/Feather weight), but open to a bolder/filled "emblem" take if it holds together.
- **Single-color first**: each glyph must work in one color (inherits `currentColor`). We _also_ pair each with a per-strategy tint (listed below) for scannability, so design monochrome, tint applied in-app.
- **Deliverable:** individual optimized **SVGs**, `24×24` viewBox, ~2px stroke, round caps/joins, no embedded raster, no text.
- Should read on a **dark background**.

## The icons we need

9 live strategies + a "Normal" state. (2 more are planned — include if easy; otherwise skip.)

| #              | Strategy         | Persona name         | What it means (the metaphor to convey)                                                                               | Suggested tint   |
| -------------- | ---------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1              | **Hero RB**      | The Anchor           | Draft one elite running back to build around, then load up on receivers. _Anchor / a single cornerstone._            | `#E0B252` gold   |
| 2              | **Zero RB**      | Volume Hunter        | Skip running backs early, hammer them for value later. _Deliberately passing on a position / "not yet."_             | `#4FB6D6` cyan   |
| 3              | **Robust RB**    | Ground & Pound       | Corner the scarce running-back position early and often. _Strength / power / stacking muscle._                       | `#E0796F` red    |
| 4              | **Balanced**     | The Balanced         | Best player available, no positional bias. _Scales / equilibrium / evenness._                                        | `#9AA7B4` slate  |
| 5              | **Streamer**     | The Streamer         | Spend early picks on RB/WR, stream QB & TE late. _Flow / current / a steady stream._                                 | `#4EC8A8` teal   |
| 6              | **Prospector**   | The Upside Merchant  | Hunt young players and rookies with breakout upside. _Digging for upside / a sprout / striking gold / a rising bet._ | `#6FCE6F` green  |
| 7              | **Proven Vet**   | The Graybeard        | Trust established veterans, fade unproven rookies. _Experience / a decorated veteran / a medal._                     | `#C79A5B` bronze |
| 8              | **Value Sniper** | The Faller Hunter    | Pounce when a player's draft-market price falls below his true value. _Precision / a crosshair on a falling target._ | `#E06F9C` rose   |
| 9              | **Stacker**      | The Correlation Play | After drafting a QB, chase his own pass-catchers (correlated upside). _Stacking / linked / layered pieces._          | `#9B8CF0` violet |
| 10             | **Normal**       | —                    | A personality-free bot: drafts straight best-available. _Neutral / default / plain._                                 | `#7A8694` gray   |
| 11 _(planned)_ | **Tier-Based**   | Cliff Watcher        | Reaches to grab the last good player before a talent "cliff." _Steps / a tier drop / a ledge._                       | tbd              |
| 12 _(planned)_ | **Homer**        | The Homer            | Chaotic — overdrafts a favorite team, chases every run. _Superfan / dice / chaos._                                   | tbd              |

## Reference

We have first-pass drafts of all of these (attached image). Some read well (anchor, dumbbell, waves, medal, crosshair, stacked layers); a few need rethinking (**Balanced** scales are too faint; **Prospector** pickaxe reads like a sickle). Use them as a jumping-off point, not a spec — improve freely.

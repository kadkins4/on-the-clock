# On The Clock — Bot Strategy Icons

Final picked set from Round 2. One icon per draft-bot strategy, 12 total.

## Spec

- 24×24 viewBox, 2px stroke, round caps/joins
- Single path color via `stroke="currentColor"` — set `color` on the parent (or the SVG) to tint
- Designed to read at 18px (list size); comfortable up to 56px badges

## Files

| File | Strategy | Code | Suggested tint |
|---|---|---|---|
| `hero-rb.svg` | Hero RB | 1A | `#E0B252` |
| `zero-rb.svg` | Zero RB | 2A | `#4FB6D6` |
| `robust-rb.svg` | Robust RB | 3A | `#E0796F` |
| `balanced.svg` | Balanced | 4A | `#9AA7B4` |
| `streamer.svg` | Streamer | 5A | `#4EC8A8` |
| `prospector.svg` | Prospector | 6A | `#6FCE6F` |
| `proven-vet.svg` | Proven Vet | 7B | `#C79A5B` |
| `value-sniper.svg` | Value Sniper | 8A | `#E06F9C` |
| `stacker.svg` | Stacker | 9B | `#9B8CF0` |
| `normal.svg` | Normal | 10A | `#7A8694` |
| `tier-based.svg` | Tier-Based | 11A | `#7FB2E5` |
| `homer.svg` | Homer | 12B | `#CE7FD1` |

## Usage

Inline the SVG (or load it in an <img> after replacing currentColor) and tint via CSS:

```html
<span style="color:#E0B252">
  <!-- hero-rb.svg contents -->
</span>
```

Badge treatment used in the app (56px): background `color-mix(in srgb, <tint> 13%, #1A2029)`,
border `1px solid color-mix(in srgb, <tint> 32%, #222933)`, radius 14–15px.

Notes: Tier-Based (11A) and Homer (12B) are the planned strategies — tints are provisional.

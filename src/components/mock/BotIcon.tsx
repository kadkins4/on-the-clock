import type { BotMixKey } from "../../lib/mock/strategy";

// Custom monoline glyphs for each bot strategy, replacing the old emoji.
// Source SVGs live in design/bot-icons/ — the inner markup below is copied from
// those files (24×24 viewBox, 2px stroke, round caps). Every glyph draws in
// `currentColor`, so a parent `color` (the per-strategy tint) flows straight in.
const GLYPHS: Record<BotMixKey, string> = {
  heroRB:
    '<circle cx="12" cy="4.8" r="2"/><line x1="12" y1="6.8" x2="12" y2="20"/><line x1="8" y1="9.8" x2="16" y2="9.8"/><path d="M5.5 13.5 a6.5 6.5 0 0 0 13 0"/><line x1="5.5" y1="13.5" x2="3.6" y2="12.4"/><line x1="18.5" y1="13.5" x2="20.4" y2="12.4"/>',
  zeroRB:
    '<circle cx="12" cy="12" r="7.5"/><line x1="6.7" y1="17.3" x2="17.3" y2="6.7"/>',
  robustRB:
    '<line x1="9" y1="12" x2="15" y2="12"/><line x1="7.5" y1="6.5" x2="7.5" y2="17.5"/><line x1="16.5" y1="6.5" x2="16.5" y2="17.5"/><line x1="4" y1="9" x2="4" y2="15"/><line x1="20" y1="9" x2="20" y2="15"/>',
  balanced:
    '<line x1="12" y1="4.5" x2="12" y2="18.5"/><line x1="8.5" y1="18.5" x2="15.5" y2="18.5"/><line x1="5" y1="7.5" x2="19" y2="7.5"/><line x1="5" y1="7.5" x2="2.8" y2="12"/><line x1="5" y1="7.5" x2="7.2" y2="12"/><path d="M2.8 12 a2.2 2.2 0 0 0 4.4 0"/><line x1="19" y1="7.5" x2="16.8" y2="12"/><line x1="19" y1="7.5" x2="21.2" y2="12"/><path d="M16.8 12 a2.2 2.2 0 0 0 4.4 0"/>',
  streamer:
    '<path d="M3.5 7 q2.85 -3 5.7 0 t5.7 0 t5.6 0"/><path d="M3.5 12 q2.85 -3 5.7 0 t5.7 0 t5.6 0"/><path d="M3.5 17 q2.85 -3 5.7 0 t5.7 0 t5.6 0"/>',
  prospector:
    '<path d="M6 8.6 Q 13.5 2 21 9.8"/><line x1="13.5" y1="5.6" x2="6" y2="20"/>',
  graybeard:
    '<polyline points="5.5 8.5, 12 4.5, 18.5 8.5"/><polyline points="5.5 14, 12 10, 18.5 14"/><polyline points="5.5 19.5, 12 15.5, 18.5 19.5"/>',
  valueSniper:
    '<circle cx="12" cy="12" r="6.5"/><line x1="12" y1="2.5" x2="12" y2="5.5"/><line x1="12" y1="18.5" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5.5" y2="12"/><line x1="18.5" y1="12" x2="21.5" y2="12"/><line x1="12" y1="8.8" x2="12" y2="14.9"/><polyline points="9.6 12.5, 12 15, 14.4 12.5"/>',
  stacker:
    '<path d="M12 3.8 L20.6 8.3 L12 12.8 L3.4 8.3 Z"/><polyline points="3.4 12.4, 12 16.9, 20.6 12.4"/><polyline points="3.4 16.1, 12 20.6, 20.6 16.1"/>',
  tiers:
    '<polyline points="3.5 6, 9.5 6, 9.5 11, 15.5 11, 15.5 16, 20.5 16, 20.5 20.5"/>',
  homer:
    '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><circle cx="8.6" cy="8.6" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.3" fill="currentColor" stroke="none"/>',
  normal:
    '<circle cx="12" cy="12" r="7.5"/><line x1="8.5" y1="12" x2="15.5" y2="12"/>',
};

// Per-strategy tint for scannability. The glyphs are drawn monochrome and take
// their color here, so a row of them reads as a coded set. Values match the
// designer's spec (design/bot-icons/README.md).
const TINTS: Record<BotMixKey, string> = {
  heroRB: "#E0B252",
  zeroRB: "#4FB6D6",
  robustRB: "#E0796F",
  balanced: "#9AA7B4",
  streamer: "#4EC8A8",
  prospector: "#6FCE6F",
  graybeard: "#C79A5B",
  valueSniper: "#E06F9C",
  stacker: "#9B8CF0",
  tiers: "#7FB2E5",
  homer: "#CE7FD1",
  normal: "#7A8694",
};

interface Props {
  id: BotMixKey;
  size?: number;
  className?: string;
  // Pass `false` to inherit `color` from the container instead of self-tinting.
  tint?: boolean;
}

// A single strategy glyph. Self-tints by default; set tint={false} to inherit.
export function BotIcon({ id, size = 18, className, tint = true }: Props) {
  const inner = GLYPHS[id];
  if (inner == null) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={tint ? { color: TINTS[id] } : undefined}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

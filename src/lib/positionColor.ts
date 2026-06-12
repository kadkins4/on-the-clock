import type { Position } from "../types";

export interface PositionStyle {
  /** Solid badge color. */
  badge: string;
  /** Cell / row background tint. */
  tint: string;
  /** Light text shown on top of the tint. */
  subtext: string;
  /** Label color on top of the badge. */
  badgeText: string;
}

// Canonical OKLCH position key — single source of truth, mirrored as --pos-*,
// --pos-*-tint and --pos-*-subtext CSS custom properties. Values copied from
// docs/design/draft-room/README.md § "Position key". Six hues at fixed chroma.
export const POSITION_KEY: Record<Position, PositionStyle> = {
  QB: {
    badge: "oklch(0.62 0.14 30)",
    tint: "oklch(0.26 0.04 30)",
    subtext: "oklch(0.72 0.06 30)",
    badgeText: "#fff",
  },
  RB: {
    badge: "oklch(0.62 0.14 150)",
    tint: "oklch(0.26 0.04 150)",
    subtext: "oklch(0.72 0.06 150)",
    badgeText: "#fff",
  },
  WR: {
    badge: "oklch(0.62 0.14 250)",
    tint: "oklch(0.26 0.04 250)",
    subtext: "oklch(0.72 0.06 250)",
    badgeText: "#fff",
  },
  TE: {
    badge: "oklch(0.66 0.13 75)",
    tint: "oklch(0.27 0.05 75)",
    subtext: "oklch(0.74 0.07 75)",
    badgeText: "#1A1407",
  },
  K: {
    badge: "oklch(0.62 0.14 310)",
    tint: "oklch(0.26 0.04 310)",
    subtext: "oklch(0.72 0.06 310)",
    badgeText: "#fff",
  },
  DST: {
    badge: "oklch(0.62 0.14 200)",
    tint: "oklch(0.26 0.04 200)",
    subtext: "oklch(0.72 0.06 200)",
    badgeText: "#fff",
  },
};

// Badge color per position. Kept as a flat map for existing consumers
// (e.g. PlayerPanel) and to mirror the --pos-* CSS vars.
export const POSITION_COLOR: Record<Position, string> = {
  QB: POSITION_KEY.QB.badge,
  RB: POSITION_KEY.RB.badge,
  WR: POSITION_KEY.WR.badge,
  TE: POSITION_KEY.TE.badge,
  K: POSITION_KEY.K.badge,
  DST: POSITION_KEY.DST.badge,
};

export function positionColor(pos: Position): string {
  return POSITION_COLOR[pos];
}

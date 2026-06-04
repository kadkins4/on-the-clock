import type { Break, Player } from "../types";
import { uid } from "./uid";

function ordered(players: Player[]): Player[] {
  return players.slice().sort((a, b) => a.overallRank - b.overallRank);
}

function sortedBreaks(breaks: Break[]): Break[] {
  return breaks.slice().sort((a, b) => a.above - b.above);
}

// Migration: derive breaks from existing contiguous `tier` values. A break sits
// wherever the tier number increases, at `above` = index of the first player of
// the new tier. Legacy boards have no empty tiers, so this is lossless for them.
export function breaksFromTiers(players: Player[]): Break[] {
  const list = ordered(players);
  const breaks: Break[] = [];
  for (let i = 1; i < list.length; i++) {
    if ((list[i].tier ?? 0) !== (list[i - 1].tier ?? 0)) {
      breaks.push({ id: uid(), above: i });
    }
  }
  return breaks;
}

// Derive each player's `tier` from breaks: tier(i) = 1 + count(above <= i).
// Empty tiers (duplicate `above`) are counted, so a player's tier may skip a
// number — that's the intended "lossy mirror" (player.tier can't hold an empty
// tier). Returns a new players array (same order) with `tier` written.
export function tiersFromBreaks(players: Player[], breaks: Break[]): Player[] {
  const sorted = sortedBreaks(breaks);
  return ordered(players).map((p, i) => ({
    ...p,
    tier: 1 + sorted.filter((b) => b.above <= i).length,
  }));
}

export type Item =
  | { kind: "player"; id: string }
  | { kind: "break"; id: string };

// Interleave players and breaks into one ordered dnd list. Breaks with the same
// `above` keep their sorted order (stable, so duplicates stay adjacent).
export function buildItems(players: Player[], breaks: Break[]): Item[] {
  const list = ordered(players);
  const sorted = sortedBreaks(breaks);
  const items: Item[] = [];
  let b = 0;
  const flushBreaksAt = (idx: number) => {
    while (b < sorted.length && sorted[b].above === idx) {
      items.push({ kind: "break", id: sorted[b].id });
      b++;
    }
  };
  for (let i = 0; i < list.length; i++) {
    flushBreaksAt(i);
    items.push({ kind: "player", id: list[i].id });
  }
  flushBreaksAt(list.length); // trailing breaks
  return items;
}

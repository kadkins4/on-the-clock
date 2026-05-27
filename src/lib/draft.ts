import type { DraftStatus } from "../types";

const ORDER: DraftStatus[] = ["available", "mine", "taken"];

export function nextDraftStatus(s: DraftStatus): DraftStatus {
  const i = ORDER.indexOf(s);
  return ORDER[(i + 1) % ORDER.length];
}

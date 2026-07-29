// The spoken form of a draft pick. Pure — no I/O, no React, no audio — so the
// wording is cheap to test and cheap to change. Every character here costs an
// ElevenLabs credit (1 char = 1 credit on the free tier), so lines stay tight.

import type { PickSignal } from "../draftValue";

const SPOKEN_POSITION: Record<string, string> = {
  QB: "quarterback",
  RB: "running back",
  WR: "wide receiver",
  TE: "tight end",
  K: "kicker",
  DST: "defense",
};

// Unknown codes read as-is rather than throwing — a mispronounced position is a
// better failure than a silent announcer.
export function spokenPosition(position: string): string {
  return SPOKEN_POSITION[position] ?? position;
}

// Flair for the draft-room moment: a pick far off its ADP baseline. Short by
// design — these ride on top of every announcement they fire on.
const FLAIR: Record<PickSignal["kind"], string> = {
  reach: "That's a big reach.",
  value: "He was still on the board?",
};

export interface AnnouncementInput {
  overall: number;
  name: string; // full name, never a surname — it is read aloud
  position: string;
  signal: PickSignal | null;
}

export function buildAnnouncement({
  overall,
  name,
  position,
  signal,
}: AnnouncementInput): string {
  const line = `With pick ${overall}, ${spokenPosition(position)} ${name}.`;
  return signal ? `${line} ${FLAIR[signal.kind]}` : line;
}

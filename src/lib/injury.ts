export interface InjuryBadge {
  code: string;
  severity: "minor" | "major";
  label: string; // human-readable status name
  description: string; // what the status means + typical return window
}

const TABLE: Record<string, InjuryBadge> = {
  QUESTIONABLE: {
    code: "Q",
    severity: "minor",
    label: "Questionable",
    description: "game-time decision, about 50/50 to play this week.",
  },
  DOUBTFUL: {
    code: "D",
    severity: "minor",
    label: "Doubtful",
    description: "Unlikely to play this week.",
  },
  OUT: {
    code: "O",
    severity: "major",
    label: "Out",
    description: "Will not play this week.",
  },
  INJURY_RESERVE: {
    code: "IR",
    severity: "major",
    label: "Injured Reserve",
    description: "Out at least 4 games; could return later in the season.",
  },
  SUSPENSION: {
    code: "SUS",
    severity: "major",
    label: "Suspended",
    description: "Ineligible to play during the suspension period.",
  },
};

export function injuryBadge(status: string | undefined): InjuryBadge | null {
  if (!status) return null;
  return TABLE[status] ?? null;
}

export interface InjuryBadge {
  code: string;
  severity: "minor" | "major";
}

export function injuryBadge(status: string | undefined): InjuryBadge | null {
  switch (status) {
    case "QUESTIONABLE":
      return { code: "Q", severity: "minor" };
    case "DOUBTFUL":
      return { code: "D", severity: "minor" };
    case "OUT":
      return { code: "O", severity: "major" };
    case "INJURY_RESERVE":
      return { code: "IR", severity: "major" };
    case "SUSPENSION":
      return { code: "SUS", severity: "major" };
    default:
      return null;
  }
}

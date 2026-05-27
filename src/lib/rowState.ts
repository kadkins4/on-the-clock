import type { DraftStatus, Flag } from "../types";

export type RowState = "mine" | "taken" | "target" | "avoid" | "neutral";

export function rowState(draftStatus: DraftStatus, flag: Flag): RowState {
  if (draftStatus === "mine") return "mine";
  if (draftStatus === "taken") return "taken";
  if (flag === "target") return "target";
  if (flag === "avoid") return "avoid";
  return "neutral";
}

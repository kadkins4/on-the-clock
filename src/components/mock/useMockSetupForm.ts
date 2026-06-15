import { useState } from "react";
import type { League, RosterSettings, Scoring } from "../../types";
import type { MockSettings } from "../../lib/mock/types";
import { valueFlagsEnabled } from "../../lib/league";
import { defaultValueThreshold } from "../../lib/draftValue";

// Snake is the only built format; Auction/Linear are previewed but coerced to
// snake on start (see DRAFT_FORMATS in MockSetup).
export type DraftFormat = "snake" | "auction" | "linear";

// Roster positions the setup screen exposes as ± steppers. SUPERFLEX is
// intentionally omitted (shown as a "coming soon" advanced row instead).
export const ROSTER_KEYS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DST",
  "bench",
] as const;
export type RosterKey = (typeof ROSTER_KEYS)[number];

function rosterTotal(r: RosterSettings): number {
  return (
    r.QB + r.RB + r.WR + r.TE + r.FLEX + r.SUPERFLEX + r.K + r.DST + r.bench
  );
}

export interface MockSetupForm {
  format: DraftFormat;
  setFormat: (f: DraftFormat) => void;
  scoring: Scoring;
  setScoring: (s: Scoring) => void;
  teams: number;
  setTeams: (n: number) => void;
  rounds: number;
  setRounds: (n: number) => void;
  userSlot: number;
  setUserSlot: (n: number) => void;
  thirdRoundReversal: boolean;
  setThirdRoundReversal: (b: boolean) => void;
  autoDraft: boolean;
  setAutoDraft: (b: boolean) => void;
  vfEnabled: boolean;
  setVfEnabled: (b: boolean) => void;
  vfThreshold: number | null;
  setVfThreshold: (n: number | null) => void;
  roster: RosterSettings;
  setRosterCount: (key: RosterKey, n: number) => void;
  advancedOpen: boolean;
  setAdvancedOpen: (b: boolean) => void;
  defaultListId: string;
  // The settings payload for createMock (rounds/scoring/roster overrides
  // included) — format is coerced to snake since it's the only built mode.
  getSettings: () => Omit<MockSettings, "rounds"> & { rounds: number };
  getValueFlags: () => { enabled: boolean; threshold: number | null };
}

// Centralizes the mock-setup form state so MockSetup stays presentational.
// Initialized from the league; produces per-mock override payloads on start.
export function useMockSetupForm(league: League): MockSetupForm {
  const defaultList =
    league.tierLists.find((t) => t.id === league.defaultTierListId) ??
    league.tierLists[0];

  const [format, setFormat] = useState<DraftFormat>("snake");
  const [scoring, setScoring] = useState<Scoring>(league.scoring);
  const [teams, setTeamsRaw] = useState(league.teams);
  const [rounds, setRounds] = useState(rosterTotal(league.roster));
  const [userSlot, setUserSlot] = useState(1);
  const [thirdRoundReversal, setThirdRoundReversal] = useState(false);
  const [autoDraft, setAutoDraft] = useState(false);
  const [vfEnabled, setVfEnabled] = useState(valueFlagsEnabled(defaultList));
  const [vfThreshold, setVfThreshold] = useState<number | null>(
    defaultList.valueFlags?.threshold ?? null,
  );
  const [roster, setRoster] = useState<RosterSettings>({ ...league.roster });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Keep the user's slot within the team count when teams shrinks.
  const setTeams = (n: number) => {
    setTeamsRaw(n);
    if (userSlot > n) setUserSlot(n);
  };

  const setRosterCount = (key: RosterKey, n: number) =>
    setRoster((r) => ({ ...r, [key]: Math.max(0, n) }));

  const getSettings = () => ({
    teams,
    userSlot,
    rounds,
    thirdRoundReversal,
    autoDraft,
    valueThreshold: vfThreshold ?? defaultValueThreshold(teams),
    valueFlagsEnabled: vfEnabled,
    scoring,
    roster,
  });

  const getValueFlags = () => ({ enabled: vfEnabled, threshold: vfThreshold });

  return {
    format,
    setFormat,
    scoring,
    setScoring,
    teams,
    setTeams,
    rounds,
    setRounds,
    userSlot,
    setUserSlot,
    thirdRoundReversal,
    setThirdRoundReversal,
    autoDraft,
    setAutoDraft,
    vfEnabled,
    setVfEnabled,
    vfThreshold,
    setVfThreshold,
    roster,
    setRosterCount,
    advancedOpen,
    setAdvancedOpen,
    defaultListId: defaultList.id,
    getSettings,
    getValueFlags,
  };
}

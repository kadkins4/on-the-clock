import { useState } from "react";
import type { League, RosterSettings, Scoring } from "../../types";
import type { MockSettings } from "../../lib/mock/types";
import type { BotMix, BotMixKey } from "../../lib/mock/strategy";
import { valueFlagsEnabled } from "../../lib/league";
import { defaultValueThreshold } from "../../lib/draftValue";

// The formats the lobby's selector shows. Snake and Linear are built; Auction
// is previewed only and coerced to snake on start (see DRAFT_FORMATS in
// MockSetup). The engine's runnable subset is DraftFormat ("snake" | "linear").
export type LobbyFormat = "snake" | "auction" | "linear";

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
  format: LobbyFormat;
  setFormat: (f: LobbyFormat) => void;
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
  botPersonalities: boolean;
  setBotPersonalities: (b: boolean) => void;
  botMix: BotMix;
  setBotMixCount: (key: BotMixKey, n: number) => void;
  resetBotMix: () => void;
  vfEnabled: boolean;
  setVfEnabled: (b: boolean) => void;
  vfThreshold: number | null;
  setVfThreshold: (n: number | null) => void;
  roster: RosterSettings;
  setRosterCount: (key: RosterKey, n: number) => void;
  advancedOpen: boolean;
  setAdvancedOpen: (b: boolean) => void;
  defaultListId: string;
  // The settings payload for createMock (rounds/scoring/roster/format overrides
  // included). Auction is coerced to snake; Linear passes through.
  getSettings: () => Omit<MockSettings, "rounds"> & { rounds: number };
  getValueFlags: () => { enabled: boolean; threshold: number | null };
}

// Centralizes the mock-setup form state so MockSetup stays presentational.
// Initialized from the league; produces per-mock override payloads on start.
export function useMockSetupForm(league: League): MockSetupForm {
  const defaultList =
    league.tierLists.find((t) => t.id === league.defaultTierListId) ??
    league.tierLists[0];

  const [format, setFormat] = useState<LobbyFormat>("snake");
  const [scoring, setScoring] = useState<Scoring>(league.scoring);
  const [teams, setTeamsRaw] = useState(league.teams);
  const [rounds, setRounds] = useState(rosterTotal(league.roster));
  const [userSlot, setUserSlot] = useState(1);
  const [thirdRoundReversal, setThirdRoundReversal] = useState(false);
  const [autoDraft, setAutoDraft] = useState(false);
  const [botPersonalities, setBotPersonalities] = useState(true);
  // Empty by default => bots are assigned random ready strategies (the prior
  // behavior). Users can dial in explicit per-strategy counts + "normal" bots.
  const [botMix, setBotMix] = useState<BotMix>({});
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

  // Set a strategy's (or "normal") bot count; 0 drops the key so an empty mix
  // cleanly means "all random".
  const setBotMixCount = (key: BotMixKey, n: number) =>
    setBotMix((m) => {
      const next = { ...m };
      if (n <= 0) delete next[key];
      else next[key] = n;
      return next;
    });
  const resetBotMix = () => setBotMix({});

  const getSettings = () => ({
    teams,
    userSlot,
    rounds,
    // Linear is built; anything else (snake / the previewed auction) runs snake.
    format: format === "linear" ? ("linear" as const) : ("snake" as const),
    // 3RR is a snake-only concept; linear ignores it in the engine anyway.
    thirdRoundReversal: format === "linear" ? false : thirdRoundReversal,
    autoDraft,
    botPersonalities,
    botMix,
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
    botPersonalities,
    setBotPersonalities,
    botMix,
    setBotMixCount,
    resetBotMix,
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

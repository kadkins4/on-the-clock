import type { Position } from "../../types";
import type { Needs } from "./roster";

// A bot's draft "personality." A strategy reshapes the pick weights by
// position × draft phase; the engine multiplies each candidate's base weight
// by `positionMultiplier`. A multiplier of 1 is neutral (no opinion), so a bot
// with no strategy — or the `balanced` strategy — drafts exactly like the
// pre-personality engine did.
export type StrategyId =
  | "heroRB"
  | "zeroRB"
  | "robustRB"
  | "balanced"
  | "streamer"
  | "tiers"
  | "upside"
  | "homer";

export interface BotStrategy {
  id: StrategyId;
  label: string; // display name, e.g. "The Anchor"
  icon: string; // quick-glance emoji
  blurb: string; // one-liner for the end-of-draft reveal
  // `true` once a strategy is fully modeled and safe to assign to bots. The
  // three that need data/context we don't have yet (tier-cliff pool context,
  // player age, per-bot favorite team) stay `false` and neutral until built.
  ready: boolean;
  positionMultiplier: (pos: Position, round: number, needs: Needs) => number;
}

const neutral = () => 1;

// Draft phases keyed off the round number (1-based).
const EARLY_END = 3; // rounds 1–3
const MID_END = 8; // rounds 4–8

export const STRATEGIES: Record<StrategyId, BotStrategy> = {
  heroRB: {
    id: "heroRB",
    label: "The Anchor",
    icon: "⚓",
    blurb: "Hero RB — one elite back, then WRs the rest of the way.",
    ready: true,
    positionMultiplier: (pos, round) => {
      if (pos === "RB") {
        if (round === 1) return 1.6; // grab the one stud
        if (round <= 5) return 0.5; // then fade RB
        return 1.2; // late RB2+ value
      }
      if (pos === "WR" && round >= 2 && round <= 8) return 1.3;
      return 1;
    },
  },
  zeroRB: {
    id: "zeroRB",
    label: "Volume Hunter",
    icon: "0️⃣",
    blurb: "Zero RB — WRs early, hammer RB value in the middle rounds.",
    ready: true,
    positionMultiplier: (pos, round) => {
      if (pos === "RB") {
        if (round <= 5) return 0.4; // punt RB early
        if (round <= 9) return 1.5; // spike on the mid-round RB value
        return 1.2;
      }
      if (pos === "WR" && round <= 5) return 1.4;
      return 1;
    },
  },
  robustRB: {
    id: "robustRB",
    label: "Ground & Pound",
    icon: "💪",
    blurb: "Robust RB — corner the scarcest position early and often.",
    ready: true,
    positionMultiplier: (pos, round) => {
      if (pos === "RB" && round <= EARLY_END) return 1.4;
      if (pos === "WR" && round > EARLY_END && round <= MID_END) return 1.2;
      return 1;
    },
  },
  balanced: {
    id: "balanced",
    label: "The Balanced",
    icon: "⚖️",
    blurb: "Best player available — no positional bias.",
    ready: true,
    positionMultiplier: neutral,
  },
  streamer: {
    id: "streamer",
    label: "The Streamer",
    icon: "🌊",
    blurb: "Late QB & TE — spends early capital on RB/WR, streams the rest.",
    ready: true,
    positionMultiplier: (pos, round) => {
      if (pos === "QB" || pos === "TE") return round <= MID_END ? 0.25 : 1.6;
      return 1;
    },
  },
  // --- Not yet assignable: need context the position hook doesn't carry. ---
  tiers: {
    id: "tiers",
    label: "Cliff Watcher",
    icon: "🪜",
    blurb: "Tier-based — reaches to stay above a tier break.",
    ready: false, // needs the candidate pool to know where the cliffs are
    positionMultiplier: neutral,
  },
  upside: {
    id: "upside",
    label: "Big-Game Hunter",
    icon: "🚀",
    blurb: "Upside — swings for ceiling and breakouts.",
    ready: false, // needs player age / experience data we don't have yet
    positionMultiplier: neutral,
  },
  homer: {
    id: "homer",
    label: "The Homer",
    icon: "🎲",
    blurb: "Chaos — overdrafts a favorite team and chases every run.",
    ready: false, // needs per-bot favorite-team state
    positionMultiplier: neutral,
  },
};

// Ids safe to hand to bots today (fully modeled position-timing strategies).
export const READY_STRATEGY_IDS: readonly StrategyId[] = Object.values(
  STRATEGIES,
)
  .filter((s) => s.ready)
  .map((s) => s.id);

export function strategyMultiplier(
  id: StrategyId,
  pos: Position,
  round: number,
  needs: Needs,
): number {
  return STRATEGIES[id].positionMultiplier(pos, round, needs);
}

import type { Player } from "../../types";
import type { Needs } from "./roster";

// Context handed to every strategy at pick time. `round` and `needs` drive the
// position-timing bots; `roster` (the bot's own picks so far) lets correlation
// bots like Stacker — and, later, pool-aware bots — see what they've built.
export interface StrategyContext {
  round: number;
  needs: Needs;
  roster: Player[];
}

// A bot's draft "personality." A strategy reshapes the pick weights per
// candidate; the engine multiplies each candidate's base weight by
// `playerMultiplier`. A multiplier of 1 is neutral (no opinion), so a bot with
// no strategy — or the `balanced` strategy — drafts exactly like the
// pre-personality engine did.
export type StrategyId =
  | "heroRB"
  | "zeroRB"
  | "robustRB"
  | "balanced"
  | "streamer"
  | "prospector"
  | "graybeard"
  | "valueSniper"
  | "stacker"
  | "tiers"
  | "homer";

// A user-authored bot mix from the setup screen: how many bot seats to hand
// each strategy. "normal" means a personality-free best-available bot. Any seats
// left unassigned are filled randomly from the ready strategies. An absent/empty
// mix means "fill every seat randomly" (the default).
export type BotMixKey = StrategyId | "normal";
export type BotMix = Partial<Record<BotMixKey, number>>;

export interface BotStrategy {
  id: StrategyId;
  name: string; // plain strategy name, e.g. "Zero RB" (used for the user's read)
  label: string; // bot persona name, e.g. "The Anchor" (used for bot reveals)
  icon: string; // quick-glance emoji
  blurb: string; // one-liner for the end-of-draft reveal
  // `true` once a strategy is fully modeled and safe to assign to bots. The two
  // that still need context we don't carry (tier-cliff pool context, per-bot
  // favorite team) stay `false` and neutral until built.
  ready: boolean;
  playerMultiplier: (player: Player, ctx: StrategyContext) => number;
}

const neutral = () => 1;

// Draft phases keyed off the round number (1-based).
const EARLY_END = 3; // rounds 1–3
const MID_END = 8; // rounds 4–8

export const STRATEGIES: Record<StrategyId, BotStrategy> = {
  heroRB: {
    id: "heroRB",
    name: "Hero RB",
    label: "The Anchor",
    icon: "⚓",
    blurb: "Hero RB — one elite back, then WRs the rest of the way.",
    ready: true,
    playerMultiplier: ({ position }, { round }) => {
      if (position === "RB") {
        if (round === 1) return 1.6; // grab the one stud
        if (round <= 5) return 0.5; // then fade RB
        return 1.2; // late RB2+ value
      }
      if (position === "WR" && round >= 2 && round <= 8) return 1.3;
      return 1;
    },
  },
  zeroRB: {
    id: "zeroRB",
    name: "Zero RB",
    label: "Volume Hunter",
    icon: "0️⃣",
    blurb: "Zero RB — WRs early, hammer RB value in the middle rounds.",
    ready: true,
    playerMultiplier: ({ position }, { round }) => {
      if (position === "RB") {
        if (round <= 5) return 0.4; // punt RB early
        if (round <= 9) return 1.5; // spike on the mid-round RB value
        return 1.2;
      }
      if (position === "WR" && round <= 5) return 1.4;
      return 1;
    },
  },
  robustRB: {
    id: "robustRB",
    name: "Robust RB",
    label: "Ground & Pound",
    icon: "💪",
    blurb: "Robust RB — corner the scarcest position early and often.",
    ready: true,
    playerMultiplier: ({ position }, { round }) => {
      if (position === "RB" && round <= EARLY_END) return 1.4;
      if (position === "WR" && round > EARLY_END && round <= MID_END)
        return 1.2;
      return 1;
    },
  },
  balanced: {
    id: "balanced",
    name: "Balanced",
    label: "The Balanced",
    icon: "⚖️",
    blurb: "Best player available — no positional bias.",
    ready: true,
    playerMultiplier: neutral,
  },
  streamer: {
    id: "streamer",
    name: "Streamer",
    label: "The Streamer",
    icon: "🌊",
    blurb: "Late QB & TE — spends early capital on RB/WR, streams the rest.",
    ready: true,
    playerMultiplier: ({ position }, { round }) => {
      if (position === "QB" || position === "TE")
        return round <= MID_END ? 0.25 : 1.6;
      return 1;
    },
  },
  // --- Age/experience personalities (unlocked by the seed bio bake). ---
  prospector: {
    id: "prospector",
    name: "Prospector",
    label: "The Upside Merchant",
    icon: "🌱",
    blurb: "Upside — hunts young players and rookies with room to break out.",
    ready: true,
    playerMultiplier: ({ yearsExp, age }) => {
      if (yearsExp != null && yearsExp <= 1) return 1.5; // rookies & sophomores
      if (age != null && age <= 24) return 1.3; // otherwise still-young talent
      return 1;
    },
  },
  graybeard: {
    id: "graybeard",
    name: "Proven Vet",
    label: "The Graybeard",
    icon: "🧓",
    blurb: "Proven vets — trusts established production, fades rookies.",
    ready: true,
    playerMultiplier: ({ yearsExp }) => {
      if (yearsExp == null) return 1;
      if (yearsExp === 0) return 0.6; // fade unproven rookies
      if (yearsExp >= 4) return 1.25; // reward the established vets
      return 1;
    },
  },
  valueSniper: {
    id: "valueSniper",
    name: "Value Sniper",
    label: "The Faller Hunter",
    icon: "🎯",
    // Board rank (overallRank) is our valuation; adp is the market. When the
    // board rates a player well above where the market drafts him, he's value.
    blurb: "Value — pounces when the board rates a player above his ADP.",
    ready: true,
    playerMultiplier: ({ adp, overallRank }) => {
      if (adp == null) return 1;
      const gap = adp - overallRank; // >0: board likes him more than the market
      if (gap <= 0) return 1;
      return 1 + (Math.min(gap, 40) / 40) * 0.6; // up to +60% for a 40-slot value
    },
  },
  stacker: {
    id: "stacker",
    name: "Stacker",
    label: "The Correlation Play",
    icon: "🔗",
    blurb: "Stacks — after landing a QB, chases his own pass-catchers.",
    ready: true,
    playerMultiplier: ({ position, team }, { roster }) => {
      const qbTeams = roster
        .filter((r) => r.position === "QB")
        .map((r) => r.team);
      if (qbTeams.length === 0) return 1; // no QB yet — no correlation to chase
      if ((position === "WR" || position === "TE") && qbTeams.includes(team))
        return 1.7;
      return 1;
    },
  },
  // --- Not yet assignable: need context the player hook doesn't carry. ---
  tiers: {
    id: "tiers",
    name: "Tier-Based",
    label: "Cliff Watcher",
    icon: "🪜",
    blurb: "Tier-based — reaches to stay above a tier break.",
    ready: false, // needs the candidate pool to know where the cliffs are
    playerMultiplier: neutral,
  },
  homer: {
    id: "homer",
    name: "Homer",
    label: "The Homer",
    icon: "🎲",
    blurb: "Chaos — overdrafts a favorite team and chases every run.",
    ready: false, // needs per-bot favorite-team state
    playerMultiplier: neutral,
  },
};

// Ids safe to hand to bots today (fully modeled strategies).
export const READY_STRATEGY_IDS: readonly StrategyId[] = Object.values(
  STRATEGIES,
)
  .filter((s) => s.ready)
  .map((s) => s.id);

export function strategyMultiplier(
  id: StrategyId,
  player: Player,
  ctx: StrategyContext,
): number {
  return STRATEGIES[id].playerMultiplier(player, ctx);
}

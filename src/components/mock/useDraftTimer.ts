import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { MockState } from "../../lib/mock/types";
import { bestAvailableId, botPickId, isComplete } from "../../lib/mock/engine";
import { playPing } from "../../lib/sound";

const BOT_DELAY = 850;
const REVEAL_MS = 1500;

interface Args {
  state: MockState;
  isUser: boolean;
  onClock: number;
  userTeamIndex: number;
  overall: number;
  onDraft: (playerId: string) => void;
  onBotTick: () => void;
}

export interface DraftTimer {
  timerSec: number | null;
  setTimerSec: Dispatch<SetStateAction<number | null>>;
  remaining: number;
  revealing: boolean;
  paused: boolean;
  setPaused: Dispatch<SetStateAction<boolean>>;
  autoOn: boolean;
  setAutoOn: Dispatch<SetStateAction<boolean>>;
  missed: boolean;
  setMissed: Dispatch<SetStateAction<boolean>>;
  missedLeft: number;
  muted: boolean;
  toggleMute: () => void;
  urgent: boolean;
}

// The live draft clock: reveal-on-the-clock hold, per-pick countdown with
// auto-pick on expiry, bot progression, optional auto-draft, the missed-pick
// modal countdown, and the mute preference. Extracted from MockDraft so the
// component owns layout while this owns the timing engine. Behavior-preserving.
export function useDraftTimer({
  state,
  isUser,
  onClock,
  userTeamIndex,
  overall,
  onDraft,
  onBotTick,
}: Args): DraftTimer {
  const [paused, setPaused] = useState(false);
  const [autoOn, setAutoOn] = useState(!!state.settings.autoDraft);
  const [missed, setMissed] = useState(false);
  const [missedLeft, setMissedLeft] = useState(25);
  const promptedRef = useRef(false);
  const [timerSec, setTimerSec] = useState<number | null>(20); // null = Off
  const [remaining, setRemaining] = useState(20);
  // The "on the clock" reveal locks the clock + Draft for a beat so the
  // typewriter + glow can play before the user can act.
  const [revealing, setRevealing] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("otc:muted") === "1";
    } catch {
      return false;
    }
  });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const toggleMute = () =>
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("otc:muted", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  // Going on the clock: ping (unless muted) and hold a 1.5s reveal during which
  // the timer is idle and Draft is locked. Re-fires for each new user pick.
  useEffect(() => {
    if (!isUser) {
      setRevealing(false);
      return;
    }
    setRevealing(true);
    if (!mutedRef.current) playPing();
    const t = setTimeout(() => setRevealing(false), REVEAL_MS);
    return () => clearTimeout(t);
  }, [isUser, overall]);

  // Reset the clock to full on a new pick, a duration change, or resuming from a
  // pause. The pause case only reaches the user's clock via undo-on-your-turn
  // (which pauses); a fresh full clock there is intended, not a resume mid-count.
  useEffect(() => {
    if (timerSec != null) setRemaining(timerSec);
  }, [overall, timerSec, paused]);

  // Countdown + auto-pick (user's live, unpaused turn only). Held during the
  // reveal so the clock doesn't start until the animation finishes.
  useEffect(() => {
    if (timerSec == null || paused || !isUser || revealing) return;
    if (remaining <= 0) {
      const id = bestAvailableId(state);
      if (id) onDraft(id);
      // Show missed-pick popup once per draft session (only when not auto-drafting)
      if (!autoOn && !promptedRef.current) {
        promptedRef.current = true;
        setMissed(true);
      }
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timerSec, paused, isUser, revealing, remaining, state, onDraft, autoOn]);

  // Bots pick automatically while running. Pausing (or a dry pool that leaves a
  // bot with no legal pick) stops the timer so the draft can't spin or fight an
  // undo.
  useEffect(() => {
    if (paused || isComplete(state) || onClock === userTeamIndex) return;
    if (!botPickId(state)) {
      setPaused(true); // stall guard: nothing legal to draft
      return;
    }
    const t = setTimeout(onBotTick, BOT_DELAY);
    return () => clearTimeout(t);
  }, [state, paused, onClock, userTeamIndex, onBotTick]);

  // Auto-draft: when enabled and it's the user's live, unpaused, non-revealing,
  // non-complete turn, pick the best available after BOT_DELAY (mirrors bot guards).
  useEffect(() => {
    if (!autoOn || !isUser || paused || revealing || isComplete(state)) return;
    const id = bestAvailableId(state);
    if (!id) return;
    const t = setTimeout(() => onDraft(id), BOT_DELAY);
    return () => clearTimeout(t);
  }, [autoOn, isUser, paused, revealing, state, onDraft]);

  // Missed-pick modal countdown: decrement missedLeft each second while modal is open;
  // at 0, activate auto-draft and close the modal.
  useEffect(() => {
    if (!missed) {
      setMissedLeft(25);
      return;
    }
    if (missedLeft <= 0) {
      setAutoOn(true);
      setMissed(false);
      return;
    }
    const t = setTimeout(() => setMissedLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [missed, missedLeft]);

  // Final-seconds alert: the stopwatch sweeps and the wordmark re-pulses.
  const urgent = isUser && !revealing && timerSec != null && remaining <= 5;

  return {
    timerSec,
    setTimerSec,
    remaining,
    revealing,
    paused,
    setPaused,
    autoOn,
    setAutoOn,
    missed,
    setMissed,
    missedLeft,
    muted,
    toggleMute,
    urgent,
  };
}

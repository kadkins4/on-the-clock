import { useCallback, useEffect, useRef, useState } from "react";
import {
  TV_CHANNEL,
  type TvMessage,
  type TvSnapshot,
} from "../../lib/mock/tvSnapshot";
import { buildAnnouncement } from "../../lib/announcer/phrase";
import { defaultAudioCache } from "../../lib/announcer/cache";
import {
  createSpeaker,
  createAudioPlayer,
  createFallbackVoice,
  type Speaker,
} from "../../lib/announcer/speak";

// Owns the TV window's channel subscription and the spoken announcement.
//
// Two behaviors worth stating, both product decisions:
//
// COALESCING — bot picks land every 850ms but a sentence takes seconds. A new
// pick cancels the one being spoken rather than queueing, so the announcer is
// always describing the *current* pick, never replaying a backlog the board has
// already moved past.
//
// CHOREOGRAPHY — the announcement starts, THEN the name flips, THEN the next
// team is on the clock. The TV window achieves this locally by holding the
// incoming snapshot for a beat; the draft engine in the other window is
// untouched and its clock keeps running.

const HOLD_MS = 400;

export interface AnnouncerChannel {
  onMessage(cb: (m: TvMessage) => void): () => void;
  post(m: TvMessage): void;
}

// Default channel: a thin wrapper over BroadcastChannel so tests can drive the
// hook synchronously without racing the real event loop.
export function broadcastChannelAdapter(): AnnouncerChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  const ch = new BroadcastChannel(TV_CHANNEL);
  return {
    onMessage(cb) {
      const handler = (e: MessageEvent<TvMessage>) => cb(e.data);
      ch.addEventListener("message", handler);
      return () => {
        ch.removeEventListener("message", handler);
        ch.close();
      };
    },
    post: (m) => ch.postMessage(m),
  };
}

function isMuted(): boolean {
  try {
    return localStorage.getItem("otc:muted") === "1";
  } catch {
    return false;
  }
}

interface Args {
  channel?: AnnouncerChannel | null;
  speaker?: Speaker;
  holdMs?: number;
  muted?: () => boolean;
}

export interface Announcer {
  snapshot: TvSnapshot | null;
  enabled: boolean;
  enable: () => void;
  toggle: () => void;
  speaking: boolean;
}

export function useAnnouncer({
  channel,
  speaker,
  holdMs = HOLD_MS,
  muted = isMuted,
}: Args = {}): Announcer {
  const [snapshot, setSnapshot] = useState<TvSnapshot | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // A snapshot that arrived while an announcement was starting, released once
  // the hold expires. Null when nothing is being held.
  const heldRef = useRef<TvSnapshot | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Built once. The real speaker holds an <audio> element whose unlocked state
  // must survive re-renders, so it must never be rebuilt mid-draft.
  const speakerRef = useRef<Speaker | null>(null);
  if (speakerRef.current == null) {
    speakerRef.current =
      speaker ??
      createSpeaker({
        fetchImpl: fetch,
        cache: defaultAudioCache(),
        player: createAudioPlayer(),
        voice: createFallbackVoice(),
      });
  }

  const mutedRef = useRef(muted);
  const holdRef = useRef(holdMs);
  useEffect(() => {
    mutedRef.current = muted;
    holdRef.current = holdMs;
  }, [muted, holdMs]);

  const releaseHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      if (heldRef.current) {
        setSnapshot(heldRef.current);
        heldRef.current = null;
      }
    }, holdRef.current);
  }, []);

  useEffect(() => {
    const ch = channel ?? broadcastChannelAdapter();
    if (!ch) return;

    const off = ch.onMessage((msg) => {
      if (msg.type === "snapshot") {
        // Hold the board only while an announcement is leading it in.
        if (holdTimerRef.current) heldRef.current = msg.snapshot;
        else setSnapshot(msg.snapshot);
        return;
      }
      if (msg.type !== "announce") return;
      if (!enabledRef.current) return;

      // Start the lead-in even when muted, so the board still advances on the
      // same rhythm rather than snapping instantly for muted viewers.
      releaseHold();
      if (mutedRef.current()) return;

      const text = buildAnnouncement(msg.announce);
      speakerRef.current?.cancel(); // coalesce: drop whatever is mid-sentence
      setSpeaking(true);
      void Promise.resolve(speakerRef.current?.speak(text))
        .catch(() => {})
        .finally(() => setSpeaking(false));
    });

    ch.post({ type: "request" });
    return () => {
      off();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [channel, releaseHold]);

  // The click that enables the announcer is also the TV window's first user
  // gesture, which is what satisfies the browser autoplay policy. The main
  // window's unlockAudio() does not help here — this is a separate document.
  const enable = useCallback(() => {
    setEnabled(true);
    try {
      localStorage.setItem("otc:announcer", "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      if (!next) speakerRef.current?.cancel(); // stop mid-sentence on turn-off
      try {
        localStorage.setItem("otc:announcer", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { snapshot, enabled, enable, toggle, speaking };
}

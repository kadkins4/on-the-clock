// Turns a sentence into audible speech, cheapest source first:
//
//   1. IndexedDB cache  — free, instant, and the common case once warm
//   2. /api/tts         — ElevenLabs, only when a key is configured server-side
//   3. speechSynthesis  — the browser's built-in voice; free and offline
//
// Tier 3 is the NORMAL production path, not an error path: the deployed site
// ships without an API key so visitors can't spend credits. Nothing here ever
// throws into the announce path — a silent pick beats a crashed TV window.

import type { AudioCache } from "./cache";

export interface AudioPlayer {
  play(blob: Blob): Promise<void>;
  stop(): void;
}

export interface FallbackVoice {
  speak(text: string): Promise<void>;
  cancel(): void;
}

export interface Speaker {
  speak(text: string): Promise<void>;
  cancel(): void;
}

interface Deps {
  fetchImpl: typeof fetch;
  cache: AudioCache;
  player: AudioPlayer;
  voice: FallbackVoice | null;
}

export function createSpeaker({
  fetchImpl,
  cache,
  player,
  voice,
}: Deps): Speaker {
  // Bumped on every cancel so an in-flight generation that resolves after a
  // newer pick arrived gets dropped instead of playing over it. This is what
  // makes coalescing in useAnnouncer actually silent.
  let generation = 0;

  async function fromNetwork(text: string): Promise<Blob | null> {
    try {
      const res = await fetchImpl("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      // 503 = no key configured, which is expected in production.
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }

  return {
    async speak(text) {
      const mine = generation;
      const stale = () => generation !== mine;

      const cached = await cache.get(text);
      if (stale()) return;

      if (cached) {
        await player.play(cached).catch(() => {});
        return;
      }

      const fresh = await fromNetwork(text);
      if (stale()) return;

      if (fresh) {
        // Cache before playing: a cancel mid-playback shouldn't cost the credit
        // twice next time.
        await cache.put(text, fresh);
        if (stale()) return;
        await player.play(fresh).catch(() => {});
        return;
      }

      await voice?.speak(text).catch(() => {});
    },

    cancel() {
      generation++;
      player.stop();
      voice?.cancel();
    },
  };
}

// ── real browser implementations ─────────────────────────────────────────────

// One shared element so the TV window's single unlock gesture keeps applying to
// every later announcement, the same way sound.ts reuses one AudioContext.
export function createAudioPlayer(): AudioPlayer {
  let el: HTMLAudioElement | null = null;
  let url: string | null = null;

  const revoke = () => {
    if (url) URL.revokeObjectURL(url);
    url = null;
  };

  return {
    play(blob) {
      el = el ?? new Audio();
      revoke();
      url = URL.createObjectURL(blob);
      el.src = url;
      return new Promise<void>((resolve) => {
        if (!el) return resolve();
        el.onended = () => resolve();
        el.onerror = () => resolve();
        void el.play().catch(() => resolve());
      });
    },
    stop() {
      el?.pause();
      revoke();
    },
  };
}

export function createFallbackVoice(): FallbackVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  return {
    speak(text) {
      return new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.onend = () => resolve();
        u.onerror = () => resolve();
        speechSynthesis.speak(u);
      });
    },
    cancel() {
      speechSynthesis.cancel();
    },
  };
}

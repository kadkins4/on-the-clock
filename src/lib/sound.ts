// Synthesized "on the clock" bell — a short Web-Audio chime (three sine partials
// with a quick decay). One call site so a real sound file can swap in later.
// No-ops if Web Audio is unavailable. Callers handle mute.

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Call from a user gesture (e.g. starting the mock) so later timer-driven plays
// are allowed under autoplay policies. Safe to call repeatedly.
export function unlockAudio(): void {
  audioCtx();
}

export function playPing(): void {
  const ac = audioCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const partials = [
    { f: 880, g: 0.5, d: 0.6 },
    { f: 1760, g: 0.22, d: 0.45 },
    { f: 2640, g: 0.1, d: 0.3 },
  ];
  for (const { f, g, d } of partials) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(g, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + d);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + d + 0.05);
  }
}

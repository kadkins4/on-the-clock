import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAnnouncer, type AnnouncerChannel } from "./useAnnouncer";
import type {
  TvMessage,
  TvSnapshot,
  TvAnnounce,
} from "../../lib/mock/tvSnapshot";

function fakeChannel() {
  let cb: ((m: TvMessage) => void) | null = null;
  const posted: TvMessage[] = [];
  const channel: AnnouncerChannel = {
    onMessage(fn) {
      cb = fn;
      return () => {
        cb = null;
      };
    },
    post(m) {
      posted.push(m);
    },
  };
  return { channel, posted, deliver: (m: TvMessage) => cb?.(m) };
}

function snap(overall: number): TvSnapshot {
  return {
    complete: false,
    round: 1,
    overall,
    totalPicks: 12,
    onClock: null,
    currentRound: [],
    latest: null,
    upNext: [],
    ticker: [],
  };
}

function announce(overall: number, name = "Jahmyr Gibbs"): TvAnnounce {
  return { overall, name, position: "RB", signal: null };
}

function fakeSpeaker() {
  const spoken: string[] = [];
  let resolveCurrent: (() => void) | null = null;
  return {
    spoken,
    cancels: { count: 0 },
    speaker: {
      speak: vi.fn((t: string) => {
        spoken.push(t);
        return new Promise<void>((r) => (resolveCurrent = r));
      }),
      cancel: vi.fn(function (this: void) {
        resolveCurrent?.();
      }),
    },
    finish: () => resolveCurrent?.(),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const HOLD = 400;

describe("useAnnouncer when disabled (the default)", () => {
  it("applies snapshots immediately so TV mode is unchanged", () => {
    const { channel, deliver } = fakeChannel();
    const { speaker } = fakeSpeaker();
    const { result } = renderHook(() =>
      useAnnouncer({ channel, speaker, holdMs: HOLD }),
    );

    expect(result.current.enabled).toBe(false);
    act(() => deliver({ type: "snapshot", snapshot: snap(3) }));
    expect(result.current.snapshot?.overall).toBe(3);
  });

  it("never speaks", () => {
    const { channel, deliver } = fakeChannel();
    const { speaker, spoken } = fakeSpeaker();
    renderHook(() => useAnnouncer({ channel, speaker, holdMs: HOLD }));

    act(() => deliver({ type: "announce", announce: announce(3) }));
    expect(spoken).toEqual([]);
  });

  it("requests a snapshot on mount so a late TV window catches up", () => {
    const { channel, posted } = fakeChannel();
    const { speaker } = fakeSpeaker();
    renderHook(() => useAnnouncer({ channel, speaker, holdMs: HOLD }));
    expect(posted).toContainEqual({ type: "request" });
  });
});

describe("useAnnouncer choreography", () => {
  it("speaks first, then flips the name after the hold", () => {
    const { channel, deliver } = fakeChannel();
    const { speaker, spoken } = fakeSpeaker();
    const { result } = renderHook(() =>
      useAnnouncer({ channel, speaker, holdMs: HOLD }),
    );
    act(() => result.current.enable());

    act(() => deliver({ type: "announce", announce: announce(5) }));
    act(() => deliver({ type: "snapshot", snapshot: snap(5) }));

    // Announcement has started but the board has NOT flipped yet.
    expect(spoken).toEqual(["With pick 5, running back Jahmyr Gibbs."]);
    expect(result.current.snapshot).toBeNull();

    act(() => void vi.advanceTimersByTime(HOLD));
    expect(result.current.snapshot?.overall).toBe(5);
  });

  it("still releases the snapshot if speaking fails", () => {
    const { channel, deliver } = fakeChannel();
    const speaker = {
      speak: () => Promise.reject(new Error("no audio")),
      cancel: vi.fn(),
    };
    const { result } = renderHook(() =>
      useAnnouncer({ channel, speaker, holdMs: HOLD }),
    );
    act(() => result.current.enable());

    act(() => deliver({ type: "announce", announce: announce(5) }));
    act(() => deliver({ type: "snapshot", snapshot: snap(5) }));
    act(() => void vi.advanceTimersByTime(HOLD));

    expect(result.current.snapshot?.overall).toBe(5);
  });
});

describe("useAnnouncer coalescing", () => {
  it("cancels the in-flight announcement and speaks only the newest", () => {
    const { channel, deliver } = fakeChannel();
    const { speaker, spoken } = fakeSpeaker();
    const { result } = renderHook(() =>
      useAnnouncer({ channel, speaker, holdMs: HOLD }),
    );
    act(() => result.current.enable());

    act(() =>
      deliver({ type: "announce", announce: announce(1, "Josh Allen") }),
    );
    act(() =>
      deliver({ type: "announce", announce: announce(2, "Bijan Robinson") }),
    );

    expect(speaker.cancel).toHaveBeenCalled();
    expect(spoken[spoken.length - 1]).toContain("Bijan Robinson");
  });

  it("does not build a backlog when picks outpace speech", () => {
    const { channel, deliver } = fakeChannel();
    const { speaker, spoken } = fakeSpeaker();
    const { result } = renderHook(() =>
      useAnnouncer({ channel, speaker, holdMs: HOLD }),
    );
    act(() => result.current.enable());

    for (let i = 1; i <= 5; i++) {
      act(() => deliver({ type: "announce", announce: announce(i) }));
    }
    // One utterance per arrival, each cancelling the last — never a queue that
    // replays five stale picks after the draft has moved on.
    expect(spoken).toHaveLength(5);
    expect(speaker.cancel).toHaveBeenCalledTimes(5);
  });

  it("shows the latest board state when picks arrive in a burst", () => {
    const { channel, deliver } = fakeChannel();
    const { speaker } = fakeSpeaker();
    const { result } = renderHook(() =>
      useAnnouncer({ channel, speaker, holdMs: HOLD }),
    );
    act(() => result.current.enable());

    act(() => deliver({ type: "announce", announce: announce(1) }));
    act(() => deliver({ type: "snapshot", snapshot: snap(1) }));
    act(() => deliver({ type: "announce", announce: announce(2) }));
    act(() => deliver({ type: "snapshot", snapshot: snap(2) }));
    act(() => void vi.advanceTimersByTime(HOLD));

    expect(result.current.snapshot?.overall).toBe(2);
  });
});

describe("useAnnouncer mute", () => {
  it("stays silent while otc:muted is set", () => {
    const { channel, deliver } = fakeChannel();
    const { speaker, spoken } = fakeSpeaker();
    const { result } = renderHook(() =>
      useAnnouncer({ channel, speaker, holdMs: HOLD, muted: () => true }),
    );
    act(() => result.current.enable());

    act(() => deliver({ type: "announce", announce: announce(5) }));
    expect(spoken).toEqual([]);
  });

  it("still advances the board when muted", () => {
    const { channel, deliver } = fakeChannel();
    const { speaker } = fakeSpeaker();
    const { result } = renderHook(() =>
      useAnnouncer({ channel, speaker, holdMs: HOLD, muted: () => true }),
    );
    act(() => result.current.enable());

    act(() => deliver({ type: "announce", announce: announce(5) }));
    act(() => deliver({ type: "snapshot", snapshot: snap(5) }));
    act(() => void vi.advanceTimersByTime(HOLD));

    expect(result.current.snapshot?.overall).toBe(5);
  });
});

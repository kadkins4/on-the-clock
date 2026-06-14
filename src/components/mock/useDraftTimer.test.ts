import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraftTimer } from "./useDraftTimer";
import { createMock } from "../../lib/mock/engine";
import type { League, Player } from "../../types";

const p = (id: string, pos: Player["position"], adp: number): Player => ({
  id,
  name: id,
  position: pos,
  team: "FA",
  overallRank: adp,
  byeWeek: null,
  tier: 1,
  adp,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

const league = (board: Player[]): League => ({
  id: "L",
  name: "Test",
  platform: "espn",
  scoring: "ppr",
  tePremium: false,
  teams: 2,
  roster: {
    QB: 1,
    RB: 1,
    WR: 1,
    TE: 0,
    FLEX: 0,
    SUPERFLEX: 0,
    K: 0,
    DST: 0,
    bench: 0,
    disabled: ["TE", "K", "DST"],
  },
  tierLists: [{ id: "tl", name: "Default", board }],
  activeTierListId: "tl",
  defaultTierListId: "tl",
  updatedAt: 0,
});

const board = [
  p("a", "RB", 1),
  p("b", "WR", 2),
  p("c", "QB", 3),
  p("d", "RB", 4),
  p("e", "WR", 5),
  p("f", "QB", 6),
];

// Fresh draft: currentTeamIndex === 0, so the user (userTeamIndex 0) is on the clock.
const userTurnState = () =>
  createMock(
    league(board),
    { teams: 2, userSlot: 1, thirdRoundReversal: false },
    1,
  );

const args = (over: Partial<Parameters<typeof useDraftTimer>[0]> = {}) => ({
  state: userTurnState(),
  isUser: true,
  onClock: 0,
  userTeamIndex: 0,
  overall: 1,
  onDraft: vi.fn(),
  onBotTick: vi.fn(),
  ...over,
});

// Advance one second at a time, flushing React between ticks. The countdown
// re-schedules its next setTimeout from an effect, so a single bulk advance
// only fires one tick; stepping per-second lets each render schedule the next.
const tick = async (seconds: number) => {
  for (let i = 0; i < seconds; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
};

describe("useDraftTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem("otc:muted", "1"); // skip playPing (no AudioContext in jsdom)
  });
  afterEach(() => vi.useRealTimers());

  it("holds the reveal, then counts down and goes urgent at <=5s", async () => {
    const { result } = renderHook(
      (a: Parameters<typeof useDraftTimer>[0]) => useDraftTimer(a),
      { initialProps: args() },
    );

    // reveal active on the clock; clock idle at full
    expect(result.current.revealing).toBe(true);
    expect(result.current.remaining).toBe(20);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500); // reveal ends
    });
    expect(result.current.revealing).toBe(false);

    await tick(1); // first countdown tick
    expect(result.current.remaining).toBe(19);
    expect(result.current.urgent).toBe(false);

    await tick(14); // down to 5
    expect(result.current.remaining).toBe(5);
    expect(result.current.urgent).toBe(true);
  });

  it("auto-picks the best available when the clock expires", async () => {
    const onDraft = vi.fn();
    renderHook((a: Parameters<typeof useDraftTimer>[0]) => useDraftTimer(a), {
      initialProps: args({ onDraft }),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500); // reveal ends
    });
    await tick(20); // run the clock to 0
    expect(onDraft).toHaveBeenCalledTimes(1);
    expect(onDraft).toHaveBeenCalledWith("a"); // best available by board order
  });

  it("toggleMute flips the flag and persists it", () => {
    const { result } = renderHook(
      (a: Parameters<typeof useDraftTimer>[0]) => useDraftTimer(a),
      { initialProps: args() },
    );
    expect(result.current.muted).toBe(true);
    act(() => result.current.toggleMute());
    expect(result.current.muted).toBe(false);
    expect(localStorage.getItem("otc:muted")).toBe("0");
  });
});

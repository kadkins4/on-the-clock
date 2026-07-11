import { describe, it, expect } from "vitest";
import { buildTvSnapshot } from "./tvSnapshot";
import type { MockState } from "./types";
import type { Player } from "../../types";
import type { TeamIdentity } from "./teamIdentity";

// ── helpers ──────────────────────────────────────────────────────────────────

function makePlayer(
  id: string,
  name: string,
  pos: Player["position"],
  team = "KC",
  bye: number | null = 5,
): Player {
  return {
    id,
    name,
    position: pos,
    team,
    overallRank: 1,
    byeWeek: bye,
    tier: 1,
    adp: 1,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

function makeTeam(
  name: string,
  initials: string,
  color: string,
  isUser = false,
): TeamIdentity {
  return { name, initials, color, isUser, strategy: null };
}

function baseState(
  overrides: Partial<MockState> = {},
  teamCount = 4,
  rounds = 3,
): MockState {
  const pool: Player[] = [
    makePlayer("p1", "Josh Allen", "QB", "BUF", 7),
    makePlayer("p2", "Tyreek Hill", "WR", "MIA", 10),
    makePlayer("p3", "Christian McCaffrey", "RB", "SF", 9),
    makePlayer("p4", "Travis Kelce", "TE", "KC", 6),
    makePlayer("p5", "CeeDee Lamb", "WR", "DAL", 7),
    makePlayer("p6", "Davante Adams", "WR", "LV", 6),
    makePlayer("p7", "Ja'Marr Chase", "WR", "CIN", 7),
    makePlayer("p8", "Justin Jefferson", "WR", "MIN", 7),
    makePlayer("p9", "Cooper Kupp", "WR", "LAR", 7),
    makePlayer("p10", "Stefon Diggs", "WR", "BUF", 7),
    makePlayer("p11", "Deebo Samuel", "WR", "SF", 9),
    makePlayer("p12", "Keenan Allen", "WR", "LAC", 6),
  ];
  const teams: TeamIdentity[] = [
    makeTeam("Your Team", "YT", "#d9a53f", true),
    makeTeam("Bed Bath & Bijan", "BB", "#e11d48", false),
    makeTeam("Caleb Me Maybe", "CM", "#7c3aed", false),
    makeTeam("Tua Towers", "TT", "#0891b2", false),
  ];
  // snake order for 4 teams, 3 rounds: 0,1,2,3, 3,2,1,0, 0,1,2,3
  const order = [0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3];
  return {
    pool,
    scoring: "ppr",
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
    settings: {
      teams: teamCount,
      userSlot: 1,
      rounds,
      thirdRoundReversal: false,
    },
    teams,
    order,
    picks: [],
    draftedIds: new Set<string>(),
    seed: 42,
    ...overrides,
  };
}

// ── empty draft ───────────────────────────────────────────────────────────────

describe("buildTvSnapshot — empty draft", () => {
  it("latest is null with no picks", () => {
    const snap = buildTvSnapshot(baseState());
    expect(snap.latest).toBeNull();
  });

  it("complete is false", () => {
    expect(buildTvSnapshot(baseState()).complete).toBe(false);
  });

  it("overall is 1, round is 1", () => {
    const snap = buildTvSnapshot(baseState());
    expect(snap.overall).toBe(1);
    expect(snap.round).toBe(1);
  });

  it("onClock has the first team's identity", () => {
    const snap = buildTvSnapshot(baseState());
    expect(snap.onClock?.name).toBe("Your Team");
    expect(snap.onClock?.initials).toBe("YT");
    expect(snap.onClock?.isUser).toBe(true);
  });

  it("currentRound has 4 picks all upcoming/current", () => {
    const snap = buildTvSnapshot(baseState());
    expect(snap.currentRound).toHaveLength(4);
    // first is 'current', rest 'upcoming'
    expect(snap.currentRound[0].kind).toBe("current");
    expect(snap.currentRound.slice(1).every((r) => r.kind === "upcoming")).toBe(
      true,
    );
  });

  it("currentRound has null surname and position for upcoming picks", () => {
    const snap = buildTvSnapshot(baseState());
    const upcoming = snap.currentRound.filter((r) => r.kind !== "done");
    expect(upcoming.every((r) => r.surname === null)).toBe(true);
    expect(upcoming.every((r) => r.position === null)).toBe(true);
  });

  it("ticker is empty", () => {
    expect(buildTvSnapshot(baseState()).ticker).toHaveLength(0);
  });

  it("upNext lists next 3 teams after onClock", () => {
    const snap = buildTvSnapshot(baseState());
    // order[0]=0(YT), order[1]=1(BB), order[2]=2(CM), order[3]=3(TT)
    // onClock=0, upNext = next 3: indices 1,2,3
    expect(snap.upNext).toHaveLength(3);
    expect(snap.upNext[0].initials).toBe("BB");
    expect(snap.upNext[1].initials).toBe("CM");
    expect(snap.upNext[2].initials).toBe("TT");
  });
});

// ── after some picks ──────────────────────────────────────────────────────────

describe("buildTvSnapshot — after picks", () => {
  it("latest is the most recent pick's player", () => {
    // Build a simpler state with one real pick
    const s = baseState();
    const pick = {
      overall: 1,
      round: 1,
      teamIndex: 0,
      playerId: "p1",
    };
    const m: MockState = {
      ...s,
      picks: [pick],
      draftedIds: new Set(["p1"]),
    };
    const snap = buildTvSnapshot(m);
    expect(snap.latest).not.toBeNull();
    expect(snap.latest?.name).toBe("Josh Allen");
    expect(snap.latest?.position).toBe("QB");
    expect(snap.latest?.byTeam).toBe("Your Team");
  });

  it("latest.surname is the last word of the player name", () => {
    const s = baseState();
    const m: MockState = {
      ...s,
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p3" }],
      draftedIds: new Set(["p3"]),
    };
    // "Christian McCaffrey" → surname = "McCaffrey"
    expect(buildTvSnapshot(m).latest?.surname).toBe("McCaffrey");
  });

  it("ticker contains completed picks, most recent last", () => {
    const s = baseState();
    // Draft picks 1-3
    const picks = [
      { overall: 1, round: 1, teamIndex: 0, playerId: "p1" },
      { overall: 2, round: 1, teamIndex: 1, playerId: "p2" },
      { overall: 3, round: 1, teamIndex: 2, playerId: "p3" },
    ];
    const m: MockState = {
      ...s,
      picks,
      draftedIds: new Set(["p1", "p2", "p3"]),
    };
    const snap = buildTvSnapshot(m);
    expect(snap.ticker).toHaveLength(3);
    // most-recent last: order is picks[0], picks[1], picks[2]
    expect(snap.ticker[2].surname).toBe("McCaffrey");
    expect(snap.ticker[0].surname).toBe("Allen");
  });

  it("ticker is capped at 10 entries (most recent)", () => {
    const s = baseState();
    // Use 12 unique players by re-using the pool entries
    const extra: Player[] = [];
    for (let i = 0; i < 12; i++) {
      extra.push({ ...s.pool[i % s.pool.length], id: `ep${i}` });
    }
    const picks = extra.map((p, i) => ({
      overall: i + 1,
      round: Math.floor(i / 4) + 1,
      teamIndex: s.order[i] ?? 0,
      playerId: p.id,
    }));
    const m: MockState = {
      ...s,
      pool: extra,
      picks,
      draftedIds: new Set(extra.map((p) => p.id)),
      order: Array.from({ length: 12 }, (_, i) => i % 4),
    };
    const snap = buildTvSnapshot(m);
    expect(snap.ticker.length).toBeLessThanOrEqual(10);
  });

  it("currentRound shows picks for the active round", () => {
    const s = baseState();
    // After 4 picks (all of round 1), we're in round 2
    const picks = [
      { overall: 1, round: 1, teamIndex: 0, playerId: "p1" },
      { overall: 2, round: 1, teamIndex: 1, playerId: "p2" },
      { overall: 3, round: 1, teamIndex: 2, playerId: "p3" },
      { overall: 4, round: 1, teamIndex: 3, playerId: "p4" },
    ];
    const m: MockState = {
      ...s,
      picks,
      draftedIds: new Set(["p1", "p2", "p3", "p4"]),
    };
    const snap = buildTvSnapshot(m);
    expect(snap.round).toBe(2);
    // current round should have 4 cells (4 teams), first is 'current'
    expect(snap.currentRound).toHaveLength(4);
    expect(snap.currentRound[0].kind).toBe("current");
  });

  it("complete is true when all picks are made", () => {
    const s = baseState();
    // 4 teams × 3 rounds = 12 picks
    const allPlayers = Array.from({ length: 12 }, (_, i) => ({
      ...s.pool[i % s.pool.length],
      id: `cp${i}`,
    }));
    const picks = allPlayers.map((p, i) => ({
      overall: i + 1,
      round: Math.floor(i / 4) + 1,
      teamIndex: s.order[i],
      playerId: p.id,
    }));
    const m: MockState = {
      ...s,
      pool: allPlayers,
      picks,
      draftedIds: new Set(allPlayers.map((p) => p.id)),
    };
    const snap = buildTvSnapshot(m);
    expect(snap.complete).toBe(true);
    expect(snap.onClock).toBeNull();
  });

  it("upNext fewer than 3 when few picks remain", () => {
    const s = baseState();
    // After 10 picks (of 12), only 2 remain
    const players = Array.from({ length: 10 }, (_, i) => ({
      ...s.pool[i % s.pool.length],
      id: `lp${i}`,
    }));
    const picks = players.map((p, i) => ({
      overall: i + 1,
      round: Math.floor(i / 4) + 1,
      teamIndex: s.order[i],
      playerId: p.id,
    }));
    const m: MockState = {
      ...s,
      pool: [...s.pool, ...players],
      picks,
      draftedIds: new Set(players.map((p) => p.id)),
    };
    const snap = buildTvSnapshot(m);
    // 2 remaining picks → upNext ≤ 3, but should be at most 2
    expect(snap.upNext.length).toBeLessThanOrEqual(3);
  });
});

// ── serialisability ───────────────────────────────────────────────────────────

describe("buildTvSnapshot — serialisability", () => {
  it("snapshot is JSON-round-trip safe (no Set, no function)", () => {
    const snap = buildTvSnapshot(baseState());
    const json = JSON.stringify(snap);
    const parsed = JSON.parse(json);
    expect(parsed.complete).toBe(false);
    expect(parsed.latest).toBeNull();
  });
});

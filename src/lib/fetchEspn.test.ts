import { describe, it, expect } from "vitest";
import { mapEspnPlayers, mergeFetched } from "./fetchEspn";
import type { Player } from "../types";

function mk(partial: Partial<Player> & { id: string }): Player {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    position: partial.position ?? "RB",
    team: partial.team ?? "FA",
    overallRank: partial.overallRank ?? 0,
    byeWeek: partial.byeWeek ?? null,
    tier: partial.tier ?? null,
    adp: partial.adp ?? null,
    notes: partial.notes ?? "",
    flag: partial.flag ?? "none",
    draftStatus: partial.draftStatus ?? "available",
    injuryStatus: partial.injuryStatus,
  };
}

describe("mapEspnPlayers", () => {
  it("maps raw entries, skips unranked/unknown positions, ranks 1..N", () => {
    const raw = [
      {
        player: {
          id: 1,
          fullName: "QB One",
          defaultPositionId: 1,
          proTeamId: 12,
          draftRanksByRankType: { PPR: { rank: 2 } },
          ownership: { averageDraftPosition: 3.5 },
          injuryStatus: "ACTIVE",
        },
      },
      {
        player: {
          id: 2,
          fullName: "RB Two",
          defaultPositionId: 2,
          proTeamId: 1,
          draftRanksByRankType: { PPR: { rank: 1 } },
          injuryStatus: "QUESTIONABLE",
        },
      },
      {
        player: {
          id: 3,
          fullName: "No Rank",
          defaultPositionId: 2,
          proTeamId: 1,
          draftRanksByRankType: {},
        },
      },
      {
        player: {
          id: 4,
          fullName: "Coach",
          defaultPositionId: 99,
          draftRanksByRankType: { PPR: { rank: 5 } },
        },
      },
    ];
    const out = mapEspnPlayers(raw);
    expect(out.map((p) => p.id)).toEqual(["2", "1"]); // sorted by PPR rank
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
    expect(out[0]).toMatchObject({
      id: "2",
      name: "RB Two",
      position: "RB",
      team: "ATL",
      injuryStatus: "QUESTIONABLE",
    });
    expect(out[1]).toMatchObject({
      id: "1",
      name: "QB One",
      position: "QB",
      team: "KC",
      adp: 3.5,
    });
    expect(out[1].injuryStatus).toBeUndefined(); // ACTIVE → not injured
  });

  it("caps the result at the top 500 (ESPN ignores the request limit)", () => {
    const raw = Array.from({ length: 600 }, (_, i) => ({
      player: {
        id: i + 1,
        fullName: `Player ${i + 1}`,
        defaultPositionId: 2,
        proTeamId: 1,
        draftRanksByRankType: { PPR: { rank: i + 1 } },
      },
    }));
    const out = mapEspnPlayers(raw);
    expect(out).toHaveLength(500);
    expect(out[out.length - 1].overallRank).toBe(500);
  });
});

describe("mergeFetched", () => {
  it("refreshes objective fields but keeps user inputs on existing players", () => {
    const current = [
      mk({
        id: "1",
        name: "Old Name",
        team: "ATL",
        adp: 10,
        tier: 1,
        flag: "target",
        draftStatus: "mine",
        notes: "love him",
        injuryStatus: "QUESTIONABLE",
        overallRank: 1,
      }),
    ];
    const fetched = [
      {
        id: "1",
        name: "New Name",
        position: "RB" as const,
        team: "DAL",
        overallRank: 1,
        adp: 5,
      },
    ];
    const [p] = mergeFetched(current, fetched);
    expect(p).toMatchObject({
      name: "New Name",
      team: "DAL",
      adp: 5,
      flag: "target",
      draftStatus: "mine",
      notes: "love him",
      tier: 1,
    });
    expect(p.injuryStatus).toBeUndefined(); // cleared — healthy now
  });

  it("inserts a new player at its ESPN-rank slot, adopting the tier above", () => {
    const current = [
      mk({ id: "1", tier: 1, overallRank: 1 }),
      mk({ id: "2", tier: 1, overallRank: 2 }),
      mk({ id: "3", tier: 2, overallRank: 3 }),
    ];
    const fetched = [
      {
        id: "1",
        name: "1",
        position: "RB" as const,
        team: "FA",
        overallRank: 1,
        adp: null,
      },
      {
        id: "2",
        name: "2",
        position: "RB" as const,
        team: "FA",
        overallRank: 2,
        adp: null,
      },
      {
        id: "3",
        name: "3",
        position: "RB" as const,
        team: "FA",
        overallRank: 4,
        adp: null,
      },
      {
        id: "99",
        name: "Rookie",
        position: "RB" as const,
        team: "FA",
        overallRank: 3,
        adp: null,
      },
    ];
    const out = mergeFetched(current, fetched);
    expect(out.map((p) => p.id)).toEqual(["1", "2", "99", "3"]);
    expect(out.find((p) => p.id === "99")!.tier).toBe(1); // adopts tier of "2" above it
  });

  it("keeps players that are not in the fetch (e.g. manual adds)", () => {
    const current = [
      mk({ id: "1", tier: 1, overallRank: 1 }),
      mk({ id: "manual", name: "My Sleeper", tier: 1, overallRank: 2 }),
    ];
    const fetched = [
      {
        id: "1",
        name: "1",
        position: "RB" as const,
        team: "FA",
        overallRank: 1,
        adp: null,
      },
    ];
    const out = mergeFetched(current, fetched);
    expect(out.map((p) => p.id)).toContain("manual");
    expect(out.find((p) => p.id === "manual")!.name).toBe("My Sleeper");
  });
});

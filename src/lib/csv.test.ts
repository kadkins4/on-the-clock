import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "./csv";
import type { Player } from "../types";

const sample: Player[] = [
  {
    id: "1",
    name: "Bijan Robinson",
    position: "RB",
    team: "ATL",
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: 2.2,
    notes: "workhorse, RB1",
    flag: "target",
    draftStatus: "available",
  },
  {
    id: "2",
    name: 'Some "Guy"',
    position: "WR",
    team: "CIN",
    overallRank: 2,
    byeWeek: 12,
    tier: 2,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  },
];

describe("toCsv / parseCsv", () => {
  it("starts with the canonical header", () => {
    expect(toCsv(sample).split("\n")[0]).toBe(
      "rank,name,position,team,bye,tier,adp,notes,flag,draft",
    );
  });

  it("round-trips field values (commas, quotes, nulls)", () => {
    const parsed = parseCsv(toCsv(sample));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("Bijan Robinson");
    expect(parsed[0].notes).toBe("workhorse, RB1");
    expect(parsed[0].adp).toBe(2.2);
    expect(parsed[0].tier).toBe(1);
    expect(parsed[0].flag).toBe("target");
    expect(parsed[0].draftStatus).toBe("available");
    expect(parsed[1].name).toBe('Some "Guy"');
    expect(parsed[1].byeWeek).toBe(12);
    expect(parsed[1].adp).toBeNull();
  });

  it("falls back to row order when rank column is absent", () => {
    const csv = "name,position,team\nAlice,RB,ATL\nBob,WR,CIN";
    const parsed = parseCsv(csv);
    expect(parsed.map((p) => p.overallRank)).toEqual([1, 2]);
    expect(parsed[1].team).toBe("CIN");
  });

  it("does not let a newline in notes corrupt the row on round-trip", () => {
    const players: Player[] = [
      {
        id: "1",
        name: "X",
        position: "RB",
        team: "ATL",
        overallRank: 1,
        byeWeek: null,
        tier: 1,
        adp: 1.1,
        notes: "line1\nline2",
        flag: "none",
        draftStatus: "available",
      },
    ];
    const parsed = parseCsv(toCsv(players));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].flag).toBe("none");
    expect(parsed[0].notes).toBe("line1 line2");
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

it("round-trips draftStatus through CSV", () => {
  const p: Player = {
    id: "1",
    name: "A",
    position: "RB",
    team: "ATL",
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "mine",
  };
  const back = parseCsv(toCsv([p]));
  expect(back[0].draftStatus).toBe("mine");
});

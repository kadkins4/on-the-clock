import { describe, it, expect } from "vitest";
import {
  ffcFormat,
  mapFfcAdp,
  normalizeName,
  adpMatchKey,
  type FfcRaw,
} from "./ffcAdp";

describe("ffcFormat", () => {
  it("maps scoring to FFC's format slug", () => {
    expect(ffcFormat("ppr")).toBe("ppr");
    expect(ffcFormat("half")).toBe("half-ppr");
    expect(ffcFormat("standard")).toBe("standard");
  });
});

describe("normalizeName", () => {
  it("lowercases, strips punctuation and generational suffixes", () => {
    expect(normalizeName("A.J. Brown")).toBe("aj brown");
    expect(normalizeName("Marvin Harrison Jr.")).toBe("marvin harrison");
    expect(normalizeName("Amon-Ra St. Brown")).toBe("amonra st brown");
    expect(normalizeName("Ja'Marr Chase")).toBe("jamarr chase");
  });
});

describe("mapFfcAdp", () => {
  const raw: FfcRaw[] = [
    { name: "Christian McCaffrey", position: "RB", team: "SF", adp: 1.4 },
    { name: "Justin Tucker", position: "PK", team: "BAL", adp: 140.9 },
    { name: "Baltimore Defense", position: "DEF", team: "BAL", adp: 131.2 },
    { name: "Bench Warmer", position: "OL", team: "SF", adp: 300 }, // unknown pos
  ];

  it("maps PK->K, DEF->DST, keeps known positions, drops unknown", () => {
    const out = mapFfcAdp(raw);
    expect(out.map((p) => p.position)).toEqual(["RB", "K", "DST"]);
  });

  it("carries name, team and adp through", () => {
    const out = mapFfcAdp(raw);
    expect(out[0]).toEqual({
      name: "Christian McCaffrey",
      position: "RB",
      team: "SF",
      adp: 1.4,
    });
  });
});

describe("adpMatchKey", () => {
  it("keys DST by team, everyone else by position + normalized name", () => {
    expect(adpMatchKey("DST", "Baltimore Defense", "BAL")).toBe("dst:BAL");
    expect(adpMatchKey("RB", "Christian McCaffrey", "SF")).toBe(
      "RB:christian mccaffrey",
    );
  });
});

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchEspnUniverse } from "./adp/sources/espn.mjs";
import { ffcFormat, mapFfcAdp } from "../src/lib/ffcAdp";
import { parseFantasyPros } from "../src/lib/adpSources/fantasypros";
import { refreshAccessToken, fetchYahooAdp } from "../src/lib/adpSources/yahoo";
import { applyAdp } from "../src/lib/blendAdp";
import type { NormalizedAdp } from "../src/lib/ffcAdp";
import type { Player } from "../src/types";

const SEASON = 2026;
const TEAMS = 12;

async function getFfc(): Promise<NormalizedAdp[]> {
  const format = ffcFormat("ppr");
  for (let i = 0; i < 3; i++) {
    const year = SEASON - i;
    const res = await fetch(
      `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${TEAMS}&year=${year}`,
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { status: string; players?: unknown[] };
    if (data.status === "Success" && data.players?.length) {
      return mapFfcAdp(data.players as Parameters<typeof mapFfcAdp>[0]);
    }
  }
  console.warn("[adp] FFC returned nothing");
  return [];
}

async function getFantasyPros(): Promise<NormalizedAdp[]> {
  try {
    const res = await fetch(
      "https://www.fantasypros.com/nfl/adp/ppr-overall.php",
      { headers: { "user-agent": "Mozilla/5.0" } },
    );
    if (!res.ok) throw new Error(String(res.status));
    return parseFantasyPros(await res.text());
  } catch (err) {
    console.warn(`[adp] FantasyPros skipped: ${(err as Error).message}`);
    return [];
  }
}

async function getYahoo(): Promise<NormalizedAdp[]> {
  const { YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, YAHOO_REFRESH_TOKEN } =
    process.env;
  if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET || !YAHOO_REFRESH_TOKEN) {
    console.warn("[adp] Yahoo creds absent — skipping Yahoo");
    return [];
  }
  try {
    const token = await refreshAccessToken(
      YAHOO_REFRESH_TOKEN,
      YAHOO_CLIENT_ID,
      YAHOO_CLIENT_SECRET,
    );
    return await fetchYahooAdp(token);
  } catch (err) {
    console.warn(`[adp] Yahoo skipped: ${(err as Error).message}`);
    return [];
  }
}

async function main() {
  const universe = (await fetchEspnUniverse()) as Player[];
  if (!universe.length) {
    console.error("ESPN universe empty — refusing to write seed.json");
    process.exit(1);
  }
  const [ffc, fantasypros, yahoo] = await Promise.all([
    getFfc(),
    getFantasyPros(),
    getYahoo(),
  ]);
  const blended = applyAdp(universe, { ffc, fantasypros, yahoo });
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, "..", "src", "data", "seed.json");
  writeFileSync(out, JSON.stringify(blended, null, 2) + "\n");
  console.log(
    `Wrote ${blended.length} players (ffc ${ffc.length}, fp ${fantasypros.length}, yahoo ${yahoo.length}) to ${out}`,
  );
}

main();

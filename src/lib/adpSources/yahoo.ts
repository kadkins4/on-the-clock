import type { Position } from "../../types";
import type { NormalizedAdp } from "../ffcAdp";

const YAHOO_POS: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
};

// Yahoo's player metadata is a list of single-key objects; pull one key out.
function field<T = string>(
  meta: Record<string, unknown>[],
  key: string,
): T | undefined {
  for (const obj of meta) {
    if (obj && typeof obj === "object" && key in obj) {
      return (obj as Record<string, T>)[key];
    }
  }
  return undefined;
}

// Map Yahoo's players;out=draft_analysis JSON into NormalizedAdp rows.
export function mapYahooAdp(json: unknown): NormalizedAdp[] {
  const out: NormalizedAdp[] = [];
  const game = (json as Record<string, unknown> | undefined)
    ?.fantasy_content as Record<string, unknown> | undefined;
  const gameArr = game?.game;
  const players = Array.isArray(gameArr)
    ? (gameArr[1] as Record<string, unknown>)?.players
    : undefined;
  if (!players || typeof players !== "object") return out;
  for (const key of Object.keys(players as Record<string, unknown>)) {
    if (key === "count") continue;
    const entry = (players as Record<string, { player?: unknown }>)[key]
      ?.player;
    if (!Array.isArray(entry)) continue;
    const meta = entry[0] as Record<string, unknown>[];
    const rawAnalysis = (entry[1] as Record<string, unknown> | undefined)
      ?.draft_analysis;
    const analysis = Array.isArray(rawAnalysis)
      ? (rawAnalysis as Record<string, unknown>[])
      : undefined;
    const nameObj = field<{ full?: string }>(meta, "name");
    const full = nameObj?.full;
    const posCode = field<string>(meta, "display_position");
    const teamRaw = field<string>(meta, "editorial_team_abbr");
    const avg = Number(field<string>(analysis ?? [], "average_pick"));
    const position = posCode ? YAHOO_POS[posCode] : undefined;
    if (!full || !position || !Number.isFinite(avg) || avg <= 0) continue;
    out.push({
      name: full,
      position,
      team: (teamRaw ?? "").toUpperCase(),
      adp: avg,
    });
  }
  return out;
}

const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

// Must exactly match the redirect URI registered on the Yahoo app. Yahoo
// deprecated "oob", so we register a dummy https URL and copy the auth code out
// of the redirected address bar (no server actually listens here).
export const YAHOO_REDIRECT_URI = "https://localhost:8080";

// Exchange a stored refresh token for a short-lived access token.
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    redirect_uri: YAHOO_REDIRECT_URI,
    refresh_token: refreshToken,
  });
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Yahoo token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token)
    throw new Error("Yahoo token refresh returned no access_token");
  return data.access_token;
}

const PLAYERS_URL =
  "https://fantasysports.yahooapis.com/fantasy/v2/game/nfl/players;sort=AR;out=draft_analysis";

// Page through Yahoo's player list (25 at a time) collecting draft-analysis ADP.
export async function fetchYahooAdp(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
  maxPlayers = 300,
): Promise<NormalizedAdp[]> {
  const all: NormalizedAdp[] = [];
  for (let start = 0; start < maxPlayers; start += 25) {
    const url = `${PLAYERS_URL};start=${start};count=25?format=json`;
    const res = await fetchImpl(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Yahoo players fetch failed: ${res.status}`);
    const page = mapYahooAdp(await res.json());
    if (page.length === 0) break;
    all.push(...page);
  }
  return all;
}

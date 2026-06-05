import { createInterface } from "node:readline/promises";
import { appendFileSync } from "node:fs";
import {
  refreshAccessToken,
  YAHOO_REDIRECT_URI,
} from "../src/lib/adpSources/yahoo";

// One-time: exchange a Yahoo authorization code for a refresh token and append
// the creds to .env.local. Set YAHOO_CLIENT_ID / YAHOO_CLIENT_SECRET first.
// The registered redirect URI (YAHOO_REDIRECT_URI) must match the Yahoo app.
const CLIENT_ID = process.env.YAHOO_CLIENT_ID;
const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET;

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(
      "Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET env vars first.",
    );
    process.exit(1);
  }
  const authUrl =
    `https://api.login.yahoo.com/oauth2/request_auth?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(YAHOO_REDIRECT_URI)}` +
    `&response_type=code&language=en-us`;
  console.log("\n1. Open this URL, sign in, and approve:\n\n" + authUrl + "\n");
  console.log(
    `2. Your browser will fail to load ${YAHOO_REDIRECT_URI} — that's expected.\n` +
      "   Copy the `code=` value out of the address bar.\n",
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("3. Paste the code: ")).trim();
  rl.close();

  const tokenRes = await fetch("https://api.login.yahoo.com/oauth2/get_token", {
    method: "POST",
    headers: {
      authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: YAHOO_REDIRECT_URI,
      code,
    }).toString(),
  });
  if (!tokenRes.ok) {
    console.error(
      "Token exchange failed:",
      tokenRes.status,
      await tokenRes.text(),
    );
    process.exit(1);
  }
  const data = (await tokenRes.json()) as { refresh_token?: string };
  if (!data.refresh_token) {
    console.error("No refresh_token returned.");
    process.exit(1);
  }
  const lines =
    `\nYAHOO_CLIENT_ID=${CLIENT_ID}\nYAHOO_CLIENT_SECRET=${CLIENT_SECRET}\n` +
    `YAHOO_REFRESH_TOKEN=${data.refresh_token}\n`;
  appendFileSync(".env.local", lines);
  console.log("\n✅ Wrote YAHOO_* to .env.local. Re-run `npm run fetch-adp`.");

  // Smoke-test the refresh immediately.
  const access = await refreshAccessToken(
    data.refresh_token,
    CLIENT_ID,
    CLIENT_SECRET,
  );
  console.log(
    "Refresh token works (got an access token:",
    access.slice(0, 8) + "…).",
  );
}

main();

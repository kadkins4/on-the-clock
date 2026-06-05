# ADP sources

`npm run fetch-adp` builds `src/data/seed.json` from a weighted blend of:

| Source      | Access                                                                | Fragility                        |
| ----------- | --------------------------------------------------------------------- | -------------------------------- |
| ESPN        | JSON API (`scripts/adp/sources/espn.mjs`)                             | stable                           |
| FFC         | JSON API (`src/lib/ffcAdp.ts`)                                        | stable                           |
| FantasyPros | **HTML scrape** of the ADP page (`src/lib/adpSources/fantasypros.ts`) | breaks if they restyle the table |
| Yahoo       | **OAuth** (`src/lib/adpSources/yahoo.ts`); creds in `.env.local`      | token/app must stay valid        |

Weights: FantasyPros 3, FFC 2, Yahoo 2, ESPN 1 (`src/lib/blendAdp.ts`).
K/DST priced by ESPN alone are floored to round ~9 (`KDST_ADP_FLOOR`).

The same blend (`applyAdp`) runs at runtime behind the **Refresh ADP** button via
the `api/adp` edge function, so the live board can refresh without a rebuild.

## Yahoo one-time setup

1. Register a free app at https://developer.yahoo.com/apps/ — **Confidential
   Client**, redirect URI `https://localhost:8080`, API permission **Fantasy
   Sports → Read**.
2. `export YAHOO_CLIENT_ID=... YAHOO_CLIENT_SECRET=...` then `npm run yahoo-auth`,
   approve in the browser, and paste the `code=` from the (failed-to-load) address
   bar. It writes `YAHOO_*` to `.env.local`.
3. For the hosted Refresh button, set the same three vars in Vercel project env.

## Yearly checklist (preseason)

1. `npm run fetch-adp` and confirm non-zero counts for each source in the log.
2. If FantasyPros count is 0, the page markup changed — fix `parseFantasyPros`
   and its fixture test.
3. If Yahoo count is 0, re-run `npm run yahoo-auth` (token likely expired).
4. Spot-check that the earliest K/DST sit around round 9+ (`adp` ≥ ~100).

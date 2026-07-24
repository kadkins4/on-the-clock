/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleAdp } from "./api/adp";
import { handleTts } from "./api/tts";
import type { Scoring } from "./src/types";

// Dev-only: serve /api/adp from the Vite dev server so the browser can reach
// FFC's ADP (which sends no CORS header) via a same-origin proxy. In production
// this same handler ships as the api/adp.ts serverless function.
function adpDevApi(): Plugin {
  return {
    name: "dev-api-adp",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        "/api/adp",
        (req: IncomingMessage, res: ServerResponse) => {
          void (async () => {
            try {
              const url = new URL(req.url ?? "", "http://localhost");
              const scoring = (url.searchParams.get("scoring") ??
                "ppr") as Scoring;
              const teams = Number(url.searchParams.get("teams") ?? "12");
              const season = Number(
                url.searchParams.get("season") ?? new Date().getFullYear(),
              );
              const body = await handleAdp({ scoring, teams, season });
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(body));
            } catch (err) {
              res.statusCode = 502;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: (err as Error).message }));
            }
          })();
        },
      );
    },
  };
}

// Dev-only: serve /api/tts from the Vite dev server so the browser posts to a
// same-origin proxy and the ElevenLabs key never reaches the client. In
// production this same handler ships as the api/tts.ts serverless function.
function ttsDevApi(env: Record<string, string | undefined>): Plugin {
  return {
    name: "dev-api-tts",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        "/api/tts",
        (req: IncomingMessage, res: ServerResponse) => {
          void (async () => {
            const chunks: Buffer[] = [];
            for await (const c of req) chunks.push(c as Buffer);
            let text = "";
            try {
              ({ text } = JSON.parse(Buffer.concat(chunks).toString()) as {
                text: string;
              });
            } catch {
              /* leave text empty → handler 400s */
            }
            // Vite does NOT copy unprefixed .env.local vars into process.env,
            // so the key is read via loadEnv below and threaded in explicitly.
            // On Vercel the real environment supplies it and api/tts.ts reads
            // process.env directly.
            const out = await handleTts({ text }, fetch, env);
            res.statusCode = out.status;
            res.setHeader(
              "content-type",
              out.headers.get("content-type") ?? "application/json",
            );
            res.end(Buffer.from(await out.arrayBuffer()));
          })();
        },
      );
    },
  };
}

export default defineConfig(({ mode }) => ({
  // "" prefix => load every var, including the unprefixed server-only secrets.
  // These stay in the dev middleware and are never handed to the client bundle.
  plugins: [
    react(),
    adpDevApi(),
    ttsDevApi(loadEnv(mode, process.cwd(), "")),
  ],
  build: {
    // The mock-draft engine and ?dev=1 panel are code-split (see App.tsx). What
    // remains in the main chunk is the framework baseline (React-DOM + dnd-kit
    // for tier/column drag), which the board needs at first paint and isn't
    // worth splitting further. Lift the advisory limit just above that baseline.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
  },
}));

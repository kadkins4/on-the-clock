/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleAdp } from "./api/adp";
import type { Scoring } from "./src/types";

// Dev-only: serve /api/adp from the Vite dev server so the browser can reach
// FFC's ADP (which sends no CORS header) via a same-origin proxy. In production
// this same handler ships as the api/adp.ts serverless function.
function adpDevApi(): Plugin {
  return {
    name: "dev-api-adp",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/adp", async (req, res) => {
        try {
          const reqUrl = (req as { url?: string }).url ?? "";
          const url = new URL(reqUrl, "http://localhost");
          const scoring = (url.searchParams.get("scoring") ?? "ppr") as Scoring;
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
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), adpDevApi()],
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
});

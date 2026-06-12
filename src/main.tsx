import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { TvWindow } from "./components/mock/TvWindow";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installErrorHandlers } from "./lib/devLog";
// Self-hosted fonts (bundled by Vite — no CDN, works offline). Weights match
// the redesign type scale; --font-* tokens in index.css reference these.
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/700.css";
import "./index.css";

installErrorHandlers();

// B9: the "#tv" hash mounts the read-only cast view (a second window mirroring
// the draft over a BroadcastChannel) instead of the full app.
const isTvWindow = window.location.hash === "#tv";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isTvWindow ? <TvWindow /> : <App />}
      <Analytics />
    </ErrorBoundary>
  </React.StrictMode>,
);

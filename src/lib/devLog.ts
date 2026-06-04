import { captureError } from "./errorReport";

let installed = false;

// Buffer uncaught errors + promise rejections (locally for the /dev panel, and
// remotely to the shared sink) so we can see what broke. Idempotent; safe to
// call once at boot.
export function installErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    captureError({
      at: Date.now(),
      message: e.message || "error",
      source: "onerror",
      stack: e.error?.stack,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    captureError({
      at: Date.now(),
      message: (r && (r.message ?? String(r))) || "unhandledrejection",
      source: "unhandledrejection",
      stack: r?.stack,
    });
  });
}

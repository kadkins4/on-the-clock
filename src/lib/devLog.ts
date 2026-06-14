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
      stack: e.error instanceof Error ? e.error.stack : undefined,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r: unknown = e.reason;
    const err = r instanceof Error ? r : undefined;
    captureError({
      at: Date.now(),
      message:
        err?.message ?? (typeof r === "string" ? r : "unhandledrejection"),
      source: "unhandledrejection",
      stack: err?.stack,
    });
  });
}

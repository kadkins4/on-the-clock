import { pushErrorLog } from "./storage";

let installed = false;

// Buffer uncaught errors + promise rejections so the gated /dev panel can show
// what went wrong on this device. Idempotent; safe to call once at boot.
export function installErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    pushErrorLog({
      at: Date.now(),
      message: e.message || "error",
      source: "onerror",
      stack: e.error?.stack,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    pushErrorLog({
      at: Date.now(),
      message: (r && (r.message ?? String(r))) || "unhandledrejection",
      source: "unhandledrejection",
      stack: r?.stack,
    });
  });
}

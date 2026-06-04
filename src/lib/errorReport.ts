import { pushErrorLog, type LoggedError } from "./storage";

const SIGS_KEY = "otc:devReportedSigs";
const MAX_SIGS = 50;

// A stable-ish fingerprint for an error, so we report each distinct problem only
// once per device (a render-error loop emits the same message repeatedly).
function sig(e: LoggedError): string {
  return `${e.source}|${e.message}`.slice(0, 200);
}

function alreadySent(s: string): boolean {
  try {
    const arr = JSON.parse(localStorage.getItem(SIGS_KEY) || "[]");
    return Array.isArray(arr) && arr.includes(s);
  } catch {
    return false;
  }
}

function markSent(s: string): void {
  try {
    const arr = JSON.parse(localStorage.getItem(SIGS_KEY) || "[]");
    const next = [s, ...(Array.isArray(arr) ? arr : [])].slice(0, MAX_SIGS);
    localStorage.setItem(SIGS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// Fire-and-forget remote crash report to the shared Formspree sink (the same
// endpoint the suggestion box uses; `kind:"error"` lets us filter the inbox).
// Deduped by signature to protect the form quota, and fully swallowed — a
// reporter that throws would be worse than the bug it's reporting. We mark a
// signature sent *before* the request so a fast error loop can't hammer the form
// even if the network is flaky (we accept losing the occasional failed send).
export function reportErrorRemote(e: LoggedError): void {
  const endpoint = import.meta.env.VITE_FORMSPREE_ENDPOINT as
    | string
    | undefined;
  if (!endpoint) return;
  const s = sig(e);
  if (alreadySent(s)) return;
  markSent(s);
  try {
    void fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: "error",
        source: "On The Clock alpha — error",
        errorSource: e.source,
        message: e.message,
        stack: e.stack?.slice(0, 1500),
        url: typeof location !== "undefined" ? location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        at: new Date(e.at).toISOString(),
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Single entry point for all error producers: buffer locally for the /dev panel
// AND report remotely. Order matters — the local buffer must never be skipped
// just because remote reporting is off or fails.
export function captureError(e: LoggedError): void {
  pushErrorLog(e);
  reportErrorRemote(e);
}

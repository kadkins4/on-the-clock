import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { reportErrorRemote } from "./errorReport";
import type { LoggedError } from "./storage";

const err: LoggedError = {
  at: 1700000000000,
  message: "boom",
  source: "onerror",
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("reportErrorRemote", () => {
  it("does nothing when the endpoint is unset", () => {
    vi.stubEnv("VITE_FORMSPREE_ENDPOINT", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    reportErrorRemote(err);
    expect(f).not.toHaveBeenCalled();
  });

  it("POSTs a kind:error payload when the endpoint is set", () => {
    vi.stubEnv("VITE_FORMSPREE_ENDPOINT", "https://formspree.io/f/test");
    const f = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", f);
    reportErrorRemote(err);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, opts] = f.mock.calls[0];
    expect(url).toBe("https://formspree.io/f/test");
    const body = JSON.parse((opts as { body: string }).body);
    expect(body.kind).toBe("error");
    expect(body.message).toBe("boom");
    expect(body.errorSource).toBe("onerror");
  });

  it("dedupes the same error signature (sends once per device)", () => {
    vi.stubEnv("VITE_FORMSPREE_ENDPOINT", "https://formspree.io/f/test");
    const f = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", f);
    reportErrorRemote(err);
    reportErrorRemote(err);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("swallows a fetch rejection (never throws)", () => {
    vi.stubEnv("VITE_FORMSPREE_ENDPOINT", "https://formspree.io/f/test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    expect(() =>
      reportErrorRemote({ ...err, message: "different" }),
    ).not.toThrow();
  });
});

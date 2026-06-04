import { describe, it, expect, afterEach, vi } from "vitest";
import { uid } from "./uid";

afterEach(() => {
  vi.restoreAllMocks();
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("uid", () => {
  it("uses crypto.randomUUID when available", () => {
    const spy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("11111111-1111-4111-8111-111111111111");
    expect(uid()).toBe("11111111-1111-4111-8111-111111111111");
    expect(spy).toHaveBeenCalled();
  });

  it("falls back to a valid unique id when randomUUID is missing", () => {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw new Error("randomUUID is not a function");
    });
    const a = uid();
    const b = uid();
    expect(a).toMatch(UUID_RE);
    expect(b).toMatch(UUID_RE);
    expect(a).not.toBe(b);
  });
});

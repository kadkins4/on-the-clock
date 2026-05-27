import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDelayedHide } from "./useDelayedHide";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDelayedHide", () => {
  it("keeps a just-hidden lingerable id visible until the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useDelayedHide(ids, ["b"], 2500),
      { initialProps: { ids: ["a", "b", "c"] } },
    );
    // 'b' drops out and is lingerable (drafted) -> it lingers
    rerender({ ids: ["a", "c"] });
    expect(result.current.rendered).toContain("b");
    expect(result.current.pending).toContain("b");

    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.rendered).not.toContain("b");
    expect(result.current.pending).not.toContain("b");
  });

  it("cancels the hide if the id returns before the delay", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useDelayedHide(ids, ["b"], 2500),
      { initialProps: { ids: ["a", "b"] } },
    );
    rerender({ ids: ["a"] }); // b hidden (lingering)
    rerender({ ids: ["a", "b"] }); // b restored (undo) before timer
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.rendered).toEqual(["a", "b"]);
    expect(result.current.pending).toEqual([]);
  });

  it("does NOT linger an id that drops out but is not lingerable (e.g. filtered/searched out)", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useDelayedHide(ids, [], 2500), // nothing eligible to linger
      { initialProps: { ids: ["a", "b", "c"] } },
    );
    // 'b' drops out due to search/filter, not drafting -> must vanish immediately
    rerender({ ids: ["a", "c"] });
    expect(result.current.rendered).not.toContain("b");
    expect(result.current.pending).toEqual([]);
  });
});

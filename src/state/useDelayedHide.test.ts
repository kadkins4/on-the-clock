import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDelayedHide } from "./useDelayedHide";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDelayedHide", () => {
  it("keeps a just-hidden id visible until the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useDelayedHide(ids, 2500),
      { initialProps: { ids: ["a", "b", "c"] } },
    );
    // 'b' becomes hidden (no longer in visible ids)
    rerender({ ids: ["a", "c"] });
    expect(result.current.rendered).toContain("b"); // still lingering
    expect(result.current.pending).toContain("b");

    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.rendered).not.toContain("b");
    expect(result.current.pending).not.toContain("b");
  });

  it("cancels the hide if the id returns before the delay", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useDelayedHide(ids, 2500),
      { initialProps: { ids: ["a", "b"] } },
    );
    rerender({ ids: ["a"] }); // b hidden
    rerender({ ids: ["a", "b"] }); // b restored (undo) before timer
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.rendered).toEqual(["a", "b"]);
    expect(result.current.pending).toEqual([]);
  });
});

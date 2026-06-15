import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "./useToast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useToast", () => {
  it("defaults to the info kind", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast("Saved"));
    expect(result.current.toast).toEqual({ message: "Saved", kind: "info" });
  });

  it("carries the requested kind", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast("Boom", "danger"));
    expect(result.current.toast).toEqual({ message: "Boom", kind: "danger" });
  });

  it("auto-dismisses after the TTL", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast("Hi", "success"));
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.toast).toBeNull();
  });

  it("a new toast replaces the current one (single slot)", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast("first", "info"));
    act(() => result.current.showToast("second", "warning"));
    expect(result.current.toast).toEqual({
      message: "second",
      kind: "warning",
    });
  });

  it("resets the dismiss timer when replaced", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast("first"));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.showToast("second"));
    // 3s after the first, 1s into the second -> still visible
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.toast?.message).toBe("second");
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.toast).toBeNull();
  });

  it("dismiss clears immediately", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast("bye"));
    act(() => result.current.dismiss());
    expect(result.current.toast).toBeNull();
  });
});

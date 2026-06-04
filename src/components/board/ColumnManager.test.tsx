import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ColumnManager } from "./ColumnManager";
import { DEFAULT_LAYOUT } from "../../lib/columnLayout";

afterEach(cleanup);

const noop = () => {};

function renderManager(
  over: Partial<Parameters<typeof ColumnManager>[0]> = {},
) {
  return render(
    <ColumnManager
      layout={DEFAULT_LAYOUT}
      onToggle={noop}
      onReorder={noop}
      onReset={noop}
      onClose={noop}
      {...over}
    />,
  );
}

describe("ColumnManager", () => {
  it("toggling a column checkbox calls onToggle with its id", () => {
    const onToggle = vi.fn();
    renderManager({ onToggle });
    fireEvent.click(screen.getByRole("checkbox", { name: /VOR/i }));
    expect(onToggle).toHaveBeenCalledWith("vor");
  });

  it("locked columns are checked and disabled", () => {
    renderManager();
    const cb = screen.getByRole("checkbox", {
      name: /Player/i,
    }) as HTMLInputElement;
    expect(cb.disabled).toBe(true);
    expect(cb.checked).toBe(true);
  });

  it("a hidden column renders unchecked", () => {
    renderManager({ layout: { ...DEFAULT_LAYOUT, hidden: ["vor"] } });
    const cb = screen.getByRole("checkbox", {
      name: /VOR/i,
    }) as HTMLInputElement;
    expect(cb.checked).toBe(false);
  });

  it("Reset to default calls onReset", () => {
    const onReset = vi.fn();
    renderManager({ onReset });
    fireEvent.click(screen.getByRole("button", { name: /reset to default/i }));
    expect(onReset).toHaveBeenCalled();
  });
});

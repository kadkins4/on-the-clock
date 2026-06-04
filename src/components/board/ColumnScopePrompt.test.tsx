import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ColumnScopePrompt } from "./ColumnScopePrompt";

afterEach(cleanup);

describe("ColumnScopePrompt", () => {
  it("Apply to all calls onChoose('all', false) by default", () => {
    const onChoose = vi.fn();
    render(<ColumnScopePrompt onChoose={onChoose} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /all leagues/i }));
    expect(onChoose).toHaveBeenCalledWith("all", false);
  });

  it("Just this league calls onChoose('this', false)", () => {
    const onChoose = vi.fn();
    render(<ColumnScopePrompt onChoose={onChoose} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /just this league/i }));
    expect(onChoose).toHaveBeenCalledWith("this", false);
  });

  it("remember checkbox passes through to onChoose", () => {
    const onChoose = vi.fn();
    render(<ColumnScopePrompt onChoose={onChoose} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /don't ask again/i }));
    fireEvent.click(screen.getByRole("button", { name: /all leagues/i }));
    expect(onChoose).toHaveBeenCalledWith("all", true);
  });

  it("Cancel calls onCancel", () => {
    const onCancel = vi.fn();
    render(<ColumnScopePrompt onChoose={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SearchPill } from "./SearchPill";

afterEach(cleanup);

describe("SearchPill", () => {
  it("shows no clear button when empty", () => {
    render(<SearchPill value="" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /clear search/i })).toBeNull();
  });
  it("shows a clear button when non-empty and clears on click", () => {
    const onChange = vi.fn();
    render(<SearchPill value="josh" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
  it("forwards typing to onChange", () => {
    const onChange = vi.fn();
    render(<SearchPill value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "a" },
    });
    expect(onChange).toHaveBeenCalledWith("a");
  });
});

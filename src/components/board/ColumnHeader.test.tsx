import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { ColumnHeader } from "./ColumnHeader";
import { orderedColumns, DEFAULT_COLUMN_ORDER } from "../../lib/columns";

function renderHeader(props: Partial<Parameters<typeof ColumnHeader>[0]> = {}) {
  const onSort = vi.fn();
  render(
    <table>
      <thead>
        <ColumnHeader
          columns={orderedColumns(DEFAULT_COLUMN_ORDER)}
          sortKey={null}
          sortAsc={true}
          onSort={onSort}
          {...props}
        />
      </thead>
    </table>,
  );
  return { onSort };
}

describe("ColumnHeader", () => {
  it("renders the labelled headers in registry order", () => {
    renderHeader();
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      "",
      "Draft",
      "★/⚑",
      "#",
      "Player",
      "Pos",
      "Team",
      "ADP",
      "VOR",
      "Bye",
      "Notes",
    ]);
  });

  it("clicking a sortable header fires onSort with its key", () => {
    const { onSort } = renderHeader();
    fireEvent.click(screen.getByText("ADP"));
    expect(onSort).toHaveBeenCalledWith("adp");
  });

  it("does not fire onSort for a non-sortable header", () => {
    const { onSort } = renderHeader();
    fireEvent.click(screen.getByText("Team"));
    expect(onSort).not.toHaveBeenCalled();
  });

  it("marks the active sorted header with a direction arrow", () => {
    renderHeader({ sortKey: "vor", sortAsc: false });
    const th = screen.getByText("VOR").closest("th")!;
    expect(th.className).toContain("sorted");
    expect(th.textContent).toContain("▼");
  });
});

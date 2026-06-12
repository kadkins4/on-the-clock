import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import { CELL_RENDERERS, type CellCtx } from "./cells";
import type { Player } from "../../types";

const player = {
  id: "p1",
  name: "Test Player",
  position: "WR",
  draftStatus: "available",
  flag: "none",
  notes: "",
  overallRank: 1,
} as unknown as Player;

const ctx = { positionalRank: 12 } as unknown as CellCtx;

test("pos cell carries the position-hue class", () => {
  const { container } = render(
    <table>
      <tbody>
        <tr>{CELL_RENDERERS.pos(player, ctx)}</tr>
      </tbody>
    </table>,
  );
  const td = container.querySelector("td.pos")!;
  expect(td.className).toContain("pos-WR");
  expect(td.textContent).toBe("WR12");
});

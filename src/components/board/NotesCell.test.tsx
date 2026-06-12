import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { NotesCell } from "./NotesCell";
import type { Player } from "../../types";
import type { Dispatch } from "react";
import type { Action } from "../../state/reducer";

function makePlayer(notes: string): Player {
  return {
    id: "p1",
    name: "Test Player",
    position: "WR",
    draftStatus: "available",
    flag: "none",
    notes,
    overallRank: 1,
  } as unknown as Player;
}

function renderCell(player: Player, dispatch: Dispatch<Action>) {
  return render(
    <table>
      <tbody>
        <tr>
          <NotesCell player={player} dispatch={dispatch} />
        </tr>
      </tbody>
    </table>,
  );
}

test("empty note: icon button is muted, no popover in DOM", () => {
  const dispatch = vi.fn();
  renderCell(makePlayer(""), dispatch);

  const btn = screen.getByRole("button", { name: /note/i });
  expect(btn).toBeTruthy();
  // Muted state: should have the empty/muted class
  expect(btn.className).toContain("notes-icon--empty");
  // No popover
  expect(document.querySelector(".notes-popover")).toBeNull();
});

test("non-empty note: icon has has-note state", () => {
  const dispatch = vi.fn();
  renderCell(makePlayer("He's a sleeper pick"), dispatch);

  const btn = screen.getByRole("button", { name: /note/i });
  expect(btn.className).toContain("notes-icon--has-note");
  // Still no popover until clicked
  expect(document.querySelector(".notes-popover")).toBeNull();
});

test("clicking icon reveals textarea pre-filled with the note", () => {
  const dispatch = vi.fn();
  renderCell(makePlayer("Great value pick"), dispatch);

  const btn = screen.getByRole("button", { name: /note/i });
  fireEvent.click(btn);

  const textarea = screen.getByRole("textbox");
  expect(textarea).toBeTruthy();
  expect((textarea as HTMLTextAreaElement).value).toBe("Great value pick");
});

test("clicking icon when empty opens popover with empty textarea", () => {
  const dispatch = vi.fn();
  renderCell(makePlayer(""), dispatch);

  const btn = screen.getByRole("button", { name: /note/i });
  fireEvent.click(btn);

  const textarea = screen.getByRole("textbox");
  expect((textarea as HTMLTextAreaElement).value).toBe("");
});

test("typing in the textarea dispatches update with new notes value", () => {
  const dispatch = vi.fn();
  renderCell(makePlayer("old note"), dispatch);

  fireEvent.click(screen.getByRole("button", { name: /note/i }));

  const textarea = screen.getByRole("textbox");
  fireEvent.change(textarea, { target: { value: "new note" } });

  expect(dispatch).toHaveBeenCalledWith({
    type: "update",
    id: "p1",
    patch: { notes: "new note" },
  });
});

test("Escape key closes the popover", () => {
  const dispatch = vi.fn();
  renderCell(makePlayer("a note"), dispatch);

  fireEvent.click(screen.getByRole("button", { name: /note/i }));
  expect(screen.getByRole("textbox")).toBeTruthy();

  fireEvent.keyDown(document, { key: "Escape" });
  expect(document.querySelector(".notes-popover")).toBeNull();
});

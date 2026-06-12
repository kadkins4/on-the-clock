import { useEffect, useRef, useState, type Dispatch } from "react";
import type { Player } from "../../types";
import type { Action } from "../../state/reducer";

interface Props {
  player: Player;
  dispatch: Dispatch<Action>;
}

export function NotesCell({ player, dispatch }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLTableCellElement>(null);

  // Close on outside mousedown
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const hasNote = player.notes.length > 0;

  return (
    <td className="notes-cell" ref={wrapRef}>
      <button
        className={
          hasNote
            ? "notes-icon notes-icon--has-note"
            : "notes-icon notes-icon--empty"
        }
        title={hasNote ? "Edit note" : "Add note"}
        aria-label={hasNote ? "Edit note" : "Add note"}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((o) => !o)}
      >
        ✎
      </button>
      {open && (
        <div className="notes-popover">
          <textarea
            className="notes-textarea"
            value={player.notes}
            placeholder="Add a note…"
            onChange={(e) =>
              dispatch({
                type: "update",
                id: player.id,
                patch: { notes: e.target.value },
              })
            }
            autoFocus
          />
        </div>
      )}
    </td>
  );
}

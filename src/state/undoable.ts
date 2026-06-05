// A small higher-order reducer that adds multi-step undo to any reducer.
//
// State becomes { past, present }. Actions are classified by `type`:
//  - `undoable`: record the current present onto `past`, then apply.
//  - `clear`:    apply, then reset `past` (a context change, e.g. switch league).
//  - anything else: apply, leave `past` untouched (pass-through).
//
// No-op guard: if the wrapped reducer returns the SAME state reference (the app's
// reducers do this when nothing changed), no history entry is recorded.
//
// There is no redo (yet); a `future` stack would add it later.

export type HistoryState<S> = { past: S[]; present: S };
export type HistoryAction = { type: "undo" };

export function withHistory<S, A extends { type: string }>(
  reducer: (state: S, action: A) => S,
  opts: { undoable: Set<string>; clear: Set<string>; limit: number },
): (h: HistoryState<S>, action: A | HistoryAction) => HistoryState<S> {
  return (h, action) => {
    if (action.type === "undo") {
      if (h.past.length === 0) return h;
      const present = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present };
    }

    const next = reducer(h.present, action as A);
    if (opts.clear.has(action.type)) {
      return { past: [], present: next };
    }
    if (next === h.present) return h; // no-op → don't grow history
    if (opts.undoable.has(action.type)) {
      const past = [...h.past, h.present].slice(-opts.limit);
      return { past, present: next };
    }
    return { past: h.past, present: next };
  };
}

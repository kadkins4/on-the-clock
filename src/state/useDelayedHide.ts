import { useEffect, useRef, useState } from "react";

/**
 * Given the set of ids that *should* be visible, returns the ids to actually
 * render — lingering ids that just dropped out for `delayMs` so a row can
 * animate out / be undone before it disappears.
 */
export function useDelayedHide(visibleIds: string[], delayMs: number) {
  const [pending, setPending] = useState<string[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prev = useRef<string[]>(visibleIds);

  useEffect(() => {
    const nowSet = new Set(visibleIds);

    // ids that just dropped out -> start a linger timer
    for (const id of prev.current) {
      if (!nowSet.has(id) && !timers.current.has(id)) {
        setPending((p) => (p.includes(id) ? p : [...p, id]));
        const t = setTimeout(() => {
          timers.current.delete(id);
          setPending((p) => p.filter((x) => x !== id));
        }, delayMs);
        timers.current.set(id, t);
      }
    }
    // a visible id that still has a pending hide timer just came back -> cancel it (undo)
    for (const id of visibleIds) {
      const t = timers.current.get(id);
      if (t) {
        clearTimeout(t);
        timers.current.delete(id);
        setPending((p) => p.filter((x) => x !== id));
      }
    }
    prev.current = visibleIds;
  }, [visibleIds, delayMs]);

  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    },
    [],
  );

  const rendered = [
    ...visibleIds,
    ...pending.filter((id) => !visibleIds.includes(id)),
  ];
  return { rendered, pending };
}

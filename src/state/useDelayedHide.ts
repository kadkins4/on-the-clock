import { useEffect, useRef, useState } from "react";

/**
 * Given the ids that *should* be visible, returns the ids to actually render.
 * An id that drops out of `visibleIds` lingers for `delayMs` (so a row can
 * animate out / be undone) ONLY if it is in `lingerableIds` — i.e. it was
 * removed because it became drafted while "hide drafted" is on, not because a
 * search/filter excluded it. Search/filter drops disappear immediately.
 */
export function useDelayedHide(
  visibleIds: string[],
  lingerableIds: string[],
  delayMs: number,
) {
  const [pending, setPending] = useState<string[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prev = useRef<string[]>(visibleIds);

  useEffect(() => {
    const nowSet = new Set(visibleIds);
    const lingerable = new Set(lingerableIds);

    // ids that just dropped out AND are eligible to linger -> start a linger timer
    for (const id of prev.current) {
      if (!nowSet.has(id) && !timers.current.has(id) && lingerable.has(id)) {
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
  }, [visibleIds, lingerableIds, delayMs]);

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

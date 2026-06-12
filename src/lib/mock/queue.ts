/**
 * Pure queue utilities for the "My Queue" (★) feature.
 * No React, no side effects — easily testable.
 */

/**
 * Toggle a player id in the queue.
 * - If absent: append to end (preserves insertion order).
 * - If present: remove (preserves order of remaining ids).
 */
export function toggleQueue(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * Return the queue minus any ids that have already been drafted.
 * Order is preserved.
 */
export function pendingQueue(
  ids: string[],
  draftedIds: ReadonlySet<string>,
): string[] {
  return ids.filter((id) => !draftedIds.has(id));
}

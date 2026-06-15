import { useCallback, useEffect, useState } from "react";

export type ToastKind = "info" | "success" | "warning" | "danger";

export interface ToastMessage {
  message: string;
  kind: ToastKind;
}

/** How long a toast stays before it auto-dismisses (ms). */
const TOAST_TTL = 4000;

/**
 * App-global transient toast. Single-slot: a new toast replaces the current
 * one (no queue — see Chunk A notes). Auto-dismisses after TOAST_TTL.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    setToast({ message, kind });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_TTL);
    return () => clearTimeout(t);
  }, [toast]);

  return { toast, showToast, dismiss };
}

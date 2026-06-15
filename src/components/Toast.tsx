import type { ToastMessage } from "./useToast";

interface Props {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

/**
 * Presentational transient toast, fixed bottom-center. Renders nothing when
 * there's no active toast. Click to dismiss early; otherwise useToast clears it.
 */
export function Toast({ toast, onDismiss }: Props) {
  if (!toast) return null;
  return (
    <div
      className={`toast toast-${toast.kind}`}
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      {toast.message}
    </div>
  );
}

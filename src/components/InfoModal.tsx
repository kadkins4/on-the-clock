import { useEffect } from "react";

// Reusable centered overlay for top-level info panes (About, Log). Dismisses on
// the ✕, a backdrop click, or Escape. Presentational — content is passed in.
export function InfoModal({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="otc-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="otc-modal" role="dialog" aria-modal="true">
        <div className="otc-modal-head">
          <h2 className="otc-modal-title">{title}</h2>
          <button
            type="button"
            className="otc-modal-x"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="otc-modal-body">{children}</div>
      </div>
    </div>
  );
}

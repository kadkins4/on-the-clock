import type { ReactNode } from "react";
import { Wordmark } from "../Wordmark";
import { Avatar } from "./Avatar";

export type DraftTab = "players" | "draft" | "board" | "tv";

const TABS: { id: DraftTab; label: string }[] = [
  { id: "players", label: "Players" },
  { id: "draft", label: "Draft" },
  { id: "board", label: "Board" },
  { id: "tv", label: "TV Mode" },
];

interface Props {
  tab: DraftTab;
  onTabChange: (t: DraftTab) => void;
  // on-the-clock pill
  teamName: string;
  initials: string;
  color: string;
  pickLabel: string; // e.g. "3.04"
  isUser: boolean; // gold pill border + reserved highlight
  isComplete: boolean;
  timer: ReactNode; // persistent live pick-clock (owned by the app bar)
  statusLine: ReactNode; // e.g. "R3 · PICK 28 OF 180"
  children: ReactNode;
}

// B1 draft-room shell: the global frame shared by every tab. App bar with the
// wordmark, the on-the-clock pill (gold when it's the local user), a persistent
// timer + status line, and the PLAYERS / DRAFT / BOARD / TV MODE tab row. The
// active tab's content renders as {children}; the live draft engine, sounds,
// and reveal all live below, untouched.
export function DraftShell({
  tab,
  onTabChange,
  teamName,
  initials,
  color,
  pickLabel,
  isUser,
  isComplete,
  timer,
  statusLine,
  children,
}: Props) {
  return (
    <div className="draft-shell">
      <header className="draft-appbar">
        <div className="draft-appbar-left">
          <div className="draft-wordmark">
            <Wordmark />
          </div>
          <div className="draft-microlabel">MOCK DRAFT</div>
        </div>

        {!isComplete && (
          <div className={`otc-pill${isUser ? " is-user" : ""}`}>
            <Avatar initials={initials} color={color} size={30} ring={isUser} />
            <div className="otc-pill-who">
              <span className="otc-pill-status">● ON THE CLOCK</span>
              <span className="otc-pill-name">
                {teamName}
                <span className="otc-pill-pick"> · {pickLabel}</span>
              </span>
            </div>
          </div>
        )}

        <div className="draft-appbar-right">
          <div className="draft-appbar-timer">{timer}</div>
          <div className="draft-appbar-status">{statusLine}</div>
        </div>
      </header>

      <nav className="draft-tabs" role="tablist" aria-label="Draft room">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "draft-tab active" : "draft-tab"}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="draft-shell-body">{children}</div>
    </div>
  );
}

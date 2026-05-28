import { useEffect, useRef, useState } from "react";
import type { Position, SortKey } from "../types";
import { POSITIONS } from "../types";

interface Props {
  search: string;
  setSearch: (s: string) => void;
  posFilter: Position | "All";
  setPosFilter: (p: Position | "All") => void;
  hideDrafted: boolean;
  setHideDrafted: (b: boolean) => void;
  sortKey: SortKey | null;
  setSortKey: (k: SortKey | null) => void;
  onFetch: () => void;
  fetching: boolean;
  onImport: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export function Toolbar(props: Props) {
  return (
    <div className="toolbar">
      <input
        className="search"
        placeholder={"Search…"}
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
      />
      <div className="chips">
        {(["All", ...POSITIONS] as const).map((p) => (
          <button
            key={p}
            className={props.posFilter === p ? "chip active" : "chip"}
            onClick={() => props.setPosFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <label className="hide-drafted">
        <input
          type="checkbox"
          checked={props.hideDrafted}
          onChange={(e) => props.setHideDrafted(e.target.checked)}
        />{" "}
        Hide drafted
      </label>
      <label>
        Sort:{" "}
        <select
          value={props.sortKey ?? "tier"}
          onChange={(e) =>
            props.setSortKey(
              e.target.value === "tier" ? null : (e.target.value as SortKey),
            )
          }
        >
          <option value="tier">Tier (grouped)</option>
          <option value="overall">Overall</option>
          <option value="adp">ADP</option>
          <option value="name">Name</option>
          <option value="bye">Bye</option>
        </select>
      </label>
      <SettingsMenu
        items={[
          {
            label: props.fetching ? "Fetching…" : "Fetch players",
            onClick: props.onFetch,
            disabled: props.fetching,
          },
          { label: "Import…", onClick: props.onImport },
          { label: "Export JSON", onClick: props.onExportJson },
          { label: "Export CSV", onClick: props.onExportCsv },
        ]}
      />
    </div>
  );
}

interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function SettingsMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="settings" ref={ref}>
      <button
        className="settings-btn"
        title="Data & settings"
        aria-label="Data & settings"
        onClick={() => setOpen((o) => !o)}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-menu">
          {items.map((it) => (
            <button
              key={it.label}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

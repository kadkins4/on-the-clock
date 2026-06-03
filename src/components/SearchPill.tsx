interface Props {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchPill({
  value,
  onChange,
  placeholder = "Search…",
  autoFocus,
}: Props) {
  return (
    <div className="search-pill">
      <svg className="search-pill-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="11"
          cy="11"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line
          x1="16.5"
          y1="16.5"
          x2="21"
          y2="21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <input
        className="search-pill-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
      {value !== "" && (
        <button
          className="search-pill-clear"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          ✕
        </button>
      )}
    </div>
  );
}

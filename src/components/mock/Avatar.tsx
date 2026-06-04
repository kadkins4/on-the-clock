interface Props {
  initials: string;
  color: string;
  size?: number; // px, default 30
  ring?: boolean; // highlight (Your Team)
}

export function Avatar({ initials, color, size = 30, ring = false }: Props) {
  return (
    <span
      className={`otc-avatar${ring ? " ring" : ""}`}
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </span>
  );
}

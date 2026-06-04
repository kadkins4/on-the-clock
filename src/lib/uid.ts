// crypto.randomUUID requires a secure context and is missing on some older
// in-app webviews. It's reached on the brand-new-visitor migration path, so a
// throw there would crash first paint. Fall back to a v4-shaped id built from
// Math.random when it's absent or throws.
export function uid(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    )
      return crypto.randomUUID();
  } catch {
    /* fall through to the manual generator */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

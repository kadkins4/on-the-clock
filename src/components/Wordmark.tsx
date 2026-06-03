// The "On The Clock." wordmark — muted "On The", accent "Clock", muted dot.
// One source of truth for the brand styling so every spoken instance (header,
// on-the-clock banner, …) matches the logo. Inline by default; inherits the
// surrounding font size, so it reads as part of whatever line it sits in.
export function Wordmark() {
  return (
    <span className="otc-wordmark">
      <span>On The</span> <strong>Clock</strong>
      <span>.</span>
    </span>
  );
}

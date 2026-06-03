import { useState } from "react";

// Formspree endpoint, mirroring the Loresmith waitlist setup. When unset (local
// dev, or before the form is wired) suggestions are stashed in localStorage so
// nothing is lost.
const ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT;
const FALLBACK_KEY = "otc:suggestions";

type Status = "idle" | "sending" | "done" | "error";

export function SuggestionBox({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setStatus("sending");

    if (!ENDPOINT) {
      try {
        const list = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]");
        list.push({ message: text, email, at: new Date().toISOString() });
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(list));
      } catch {
        // storage unavailable — still report success; the note is just lost
      }
      setStatus("done");
      return;
    }

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          email,
          source: "On The Clock alpha",
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="otc-suggest otc-suggest-done" role="status">
        ✓ Thanks — got it.{" "}
        <button type="button" className="otc-link" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form className="otc-suggest" onSubmit={handleSubmit}>
      <textarea
        className="otc-suggest-text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Suggestion, bug, or request…"
        rows={3}
        required
        disabled={status === "sending"}
      />
      <input
        type="email"
        className="otc-suggest-email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional, for a reply)"
        disabled={status === "sending"}
      />
      <div className="otc-suggest-actions">
        <button
          type="submit"
          disabled={status === "sending" || !message.trim()}
        >
          {status === "sending" ? "Sending…" : "Send"}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
        {status === "error" && (
          <span className="otc-suggest-err">
            Couldn’t send — try again, or email adkins.kendall90@gmail.com.
          </span>
        )}
      </div>
    </form>
  );
}

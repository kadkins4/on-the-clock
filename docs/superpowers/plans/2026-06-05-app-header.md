# App Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brand-only header with a minimalist header section housing the brand + tagline, About/Log info links, and Mock/Draft action buttons.

**Architecture:** A new presentational `Header` component renders the row and takes every action as a handler prop. A reusable `InfoModal` provides the About/Log overlay; their static copy lives in `infoContent.tsx`. `App` owns the new `infoModal` state, moves the Mock entry point here from the Toolbar settings menu, and wires Draft to a "coming soon" toast.

**Tech Stack:** React 19, TypeScript, Vite, vitest + @testing-library/react. Package manager: **pnpm**.

Spec: `docs/superpowers/specs/2026-06-05-app-header-design.md`

---

## File Structure

- Create `src/components/Header.tsx` — the header row (presentational).
- Create `src/components/Header.test.tsx` — Header tests.
- Create `src/components/InfoModal.tsx` — reusable centered modal chrome.
- Create `src/components/InfoModal.test.tsx` — InfoModal tests.
- Create `src/components/infoContent.tsx` — `AboutContent` + `LogContent` static copy.
- Create `src/components/infoContent.test.tsx` — smoke render test.
- Modify `src/App.tsx` — render `Header` + `InfoModal`, add `infoModal` state, `onDraft` toast, drop Toolbar's `onMock`.
- Modify `src/components/Toolbar.tsx` — remove the Mock menu item and the `onMock` prop.
- Modify `src/components/Toolbar.test.tsx` — drop `onMock` from the test props.
- Modify `src/index.css` — header, links, buttons, tagline, divider, and modal styles.

Notes: this is a single subsystem — one plan. No new dependencies. Tests assert via `toBeTruthy()` / `toHaveBeenCalled()` (no jest-dom in this repo).

---

## Task 0: Setup

**Files:** none (fresh worktree needs deps installed).

- [ ] **Step 1: Install dependencies**

Run: `pnpm install`
Expected: completes; `node_modules/` present.

- [ ] **Step 2: Baseline test run**

Run: `pnpm test`
Expected: all existing tests PASS (green baseline before changes).

---

## Task 1: InfoModal component

**Files:**

- Create: `src/components/InfoModal.tsx`
- Test: `src/components/InfoModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/InfoModal.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InfoModal } from "./InfoModal";

afterEach(cleanup);

describe("InfoModal", () => {
  it("renders the title and children", () => {
    render(
      <InfoModal title="About" onClose={() => {}}>
        <p>hello</p>
      </InfoModal>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("About")).toBeTruthy();
    expect(screen.getByText("hello")).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <InfoModal title="About" onClose={onClose}>
        x
      </InfoModal>,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <InfoModal title="About" onClose={onClose}>
        x
      </InfoModal>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click but not on a click inside the dialog", () => {
    const onClose = vi.fn();
    const { container } = render(
      <InfoModal title="About" onClose={onClose}>
        x
      </InfoModal>,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector(".otc-modal-backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test InfoModal`
Expected: FAIL — cannot resolve `./InfoModal`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/InfoModal.tsx`:

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test InfoModal`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/InfoModal.tsx src/components/InfoModal.test.tsx
git commit -m "Add reusable InfoModal component"
```

---

## Task 2: About / Log content

**Files:**

- Create: `src/components/infoContent.tsx`
- Test: `src/components/infoContent.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/infoContent.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AboutContent, LogContent } from "./infoContent";

afterEach(cleanup);

describe("info content", () => {
  it("AboutContent describes the app", () => {
    render(<AboutContent />);
    expect(screen.getByText(/draft-day cheat sheet/i)).toBeTruthy();
  });

  it("LogContent lists shipped items", () => {
    render(<LogContent />);
    expect(screen.getByText(/Multi-source ADP/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test infoContent`
Expected: FAIL — cannot resolve `./infoContent`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/infoContent.tsx`:

```tsx
// Static copy for the header's About and Log modals. Kept apart from InfoModal
// (the chrome) so wording can change without touching modal behavior.

export function AboutContent() {
  return (
    <>
      <p>
        A draft-day cheat sheet that stays out of your way. Build tiers, mark
        targets, and track every pick on a single fast board — no logins, your
        data lives in your browser.
      </p>
      <ul>
        <li>Custom tiers &amp; target flags you control</li>
        <li>A multi-source ADP blend you can refresh live</li>
        <li>Mock drafts to rehearse your strategy</li>
        <li>Per-league columns, scoring, and rosters</li>
      </ul>
    </>
  );
}

export function LogContent() {
  return (
    <ul className="otc-log">
      <li>
        <b>Multi-source ADP</b> — blended ESPN, FantasyPros, FFC &amp; Yahoo.
      </li>
      <li>
        <b>Mock drafts</b> — rehearse against auto-drafting opponents.
      </li>
      <li>
        <b>Draggable tiers</b> — split and reorder tier breaks inline.
      </li>
      <li className="otc-log-next">
        <b>Coming next:</b> live draft mode.
      </li>
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test infoContent`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/infoContent.tsx src/components/infoContent.test.tsx
git commit -m "Add About and Log modal content"
```

---

## Task 3: Header component

**Files:**

- Create: `src/components/Header.tsx`
- Test: `src/components/Header.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/Header.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Header } from "./Header";

afterEach(cleanup);

function setup(over: Partial<React.ComponentProps<typeof Header>> = {}) {
  const props = {
    onBrandClick: vi.fn(),
    onAbout: vi.fn(),
    onLog: vi.fn(),
    onMock: vi.fn(),
    onDraft: vi.fn(),
    ...over,
  };
  render(<Header {...props} />);
  return props;
}

describe("Header", () => {
  it("renders the tagline, links and action buttons", () => {
    setup();
    expect(screen.getByText("draft day cheat sheet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "About" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mock" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Draft" })).toBeTruthy();
  });

  it("fires the matching handler for each action", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    fireEvent.click(screen.getByRole("button", { name: "Mock" }));
    fireEvent.click(screen.getByRole("button", { name: "Draft" }));
    expect(p.onAbout).toHaveBeenCalledTimes(1);
    expect(p.onLog).toHaveBeenCalledTimes(1);
    expect(p.onMock).toHaveBeenCalledTimes(1);
    expect(p.onDraft).toHaveBeenCalledTimes(1);
  });

  it("fires onBrandClick from the brand button", () => {
    const p = setup();
    fireEvent.click(
      screen.getByRole("button", { name: /refresh and replay/i }),
    );
    expect(p.onBrandClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test Header`
Expected: FAIL — cannot resolve `./Header`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/Header.tsx`:

```tsx
import { Wordmark } from "./Wordmark";

// The app header: brand (logo + wordmark + tagline), a divider, the About/Log
// info links, then the Mock / Draft actions. Presentational — every action is a
// handler passed down from App. Clicking the brand keeps the old refresh +
// replay-intro behavior.
export function Header({
  onBrandClick,
  onAbout,
  onLog,
  onMock,
  onDraft,
}: {
  onBrandClick: () => void;
  onAbout: () => void;
  onLog: () => void;
  onMock: () => void;
  onDraft: () => void;
}) {
  return (
    <header className="otc-header">
      <button
        type="button"
        className="otc-brand"
        onClick={onBrandClick}
        title="Refresh & replay intro"
        aria-label="Refresh and replay intro"
      >
        <svg className="otc-logo" viewBox="0 0 64 64" width="32" height="32">
          <circle
            cx="32"
            cy="34"
            r="17"
            fill="none"
            stroke="#ff6b4a"
            strokeWidth="4"
          />
          <rect x="26" y="9" width="12" height="5" rx="2.5" fill="#ff6b4a" />
          <line
            x1="32"
            y1="34"
            x2="32"
            y2="23"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line
            x1="32"
            y1="34"
            x2="40"
            y2="38"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="otc-brand-text">
          <h1 className="otc-title">
            <Wordmark />
          </h1>
          <span className="otc-tagline">draft day cheat sheet</span>
        </span>
      </button>
      <span className="otc-header-divider" aria-hidden="true" />
      <nav className="otc-header-links">
        <button type="button" className="otc-navlink" onClick={onAbout}>
          About
        </button>
        <button type="button" className="otc-navlink" onClick={onLog}>
          Log
        </button>
      </nav>
      <span className="otc-header-spacer" />
      <div className="otc-header-actions">
        <button type="button" className="otc-btn" onClick={onMock}>
          Mock
        </button>
        <button
          type="button"
          className="otc-btn otc-btn-primary"
          onClick={onDraft}
        >
          Draft
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test Header`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/Header.test.tsx
git commit -m "Add Header component"
```

---

## Task 4: Header + modal styling

**Files:**

- Modify: `src/index.css` (replace the `.otc-header` rule ~line 1243; append new rules after the brand/wordmark block ~line 1288).

CSS is not unit-tested — verify visually against the approved mockup.

- [ ] **Step 1: Replace the `.otc-header` rule**

Find in `src/index.css`:

```css
.otc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 0.4rem;
}
```

Replace with:

```css
.otc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 0.6rem;
}
```

- [ ] **Step 2: Update `.otc-brand` gap**

Find:

```css
.otc-brand {
  display: inline-flex;
  align-items: center;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font: inherit;
  border-radius: 8px;
}
```

Replace the `align-items: center;` line so the rule reads:

```css
.otc-brand {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font: inherit;
  border-radius: 8px;
}
```

- [ ] **Step 3: Append the new header + modal rules**

Add after the `.otc-wordmark strong { ... }` block (end of the wordmark section, ~line 1288):

```css
/* --- Header: tagline, divider, links, actions --- */
.otc-brand-text {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.otc-tagline {
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-top: 4px;
  text-transform: lowercase;
}
.otc-header-divider {
  width: 1px;
  height: 30px;
  background: var(--border);
  margin: 0 4px;
}
.otc-header-links {
  display: flex;
  align-items: center;
  gap: 4px;
}
.otc-navlink {
  font: inherit;
  font-size: 13px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: #ffffff33;
  padding: 6px 6px;
  transition: 0.14s ease;
}
.otc-navlink:hover {
  color: var(--text);
  text-decoration-color: var(--otc-accent);
}
.otc-header-spacer {
  flex: 1;
}
.otc-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.otc-btn {
  font: inherit;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
  transition: 0.14s ease;
}
.otc-btn:hover {
  border-color: #3a4150;
  background: #1c2029;
}
.otc-btn-primary {
  background: var(--otc-accent);
  border-color: var(--otc-accent);
  color: #1a0f0a;
  font-weight: 650;
}
.otc-btn-primary:hover {
  background: #ff7d5f;
  border-color: #ff7d5f;
}

/* --- Info modal (About / Log) --- */
.otc-modal-backdrop {
  position: fixed;
  inset: 0;
  background: #000a;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
}
.otc-modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  max-width: 460px;
  width: 100%;
  padding: 18px 22px 20px;
}
.otc-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.otc-modal-title {
  margin: 0;
  font-size: 17px;
}
.otc-modal-x {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}
.otc-modal-x:hover {
  color: var(--text);
}
.otc-modal-body {
  color: var(--muted);
  font-size: 13.5px;
  line-height: 1.5;
}
.otc-modal-body ul {
  padding-left: 18px;
}
.otc-log {
  list-style: none;
  padding-left: 0;
}
.otc-log b {
  color: var(--text);
}
.otc-log-next {
  margin-top: 8px;
  color: var(--otc-accent);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "Add header and info-modal styles"
```

(Visual verification happens in Task 7 with the dev server.)

---

## Task 5: Wire Header + InfoModal into App

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports**

Near the other component imports in `src/App.tsx` (the block importing `Toolbar`, `AlphaBanner`, `Wordmark`), add:

```tsx
import { Header } from "./components/Header";
import { InfoModal } from "./components/InfoModal";
import { AboutContent, LogContent } from "./components/infoContent";
```

`Wordmark` is already imported — reuse it for the About modal title.

- [ ] **Step 2: Add modal state**

Just after `const [toast, setToast] = useState<string | null>(null);`, add:

```tsx
const [infoModal, setInfoModal] = useState<"about" | "log" | null>(null);
```

- [ ] **Step 3: Replace the inline header block with `<Header/>`**

Find the inline header in the returned JSX:

```tsx
<header className="otc-header">
  <button
    type="button"
    className="otc-brand"
    onClick={onBrandClick}
    title="Refresh & replay intro"
    aria-label="Refresh and replay intro"
  >
    <svg className="otc-logo" viewBox="0 0 64 64" width="30" height="30">
      {/* <rect width="64" height="64" rx="15" fill="#14161f" /> */}
      <circle
        cx="32"
        cy="34"
        r="17"
        fill="none"
        stroke="#ff6b4a"
        strokeWidth="4"
      />
      <rect x="26" y="9" width="12" height="5" rx="2.5" fill="#ff6b4a" />
      <line
        x1="32"
        y1="34"
        x2="32"
        y2="23"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="34"
        x2="40"
        y2="38"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
    <h1 className="otc-title">
      <Wordmark />
    </h1>
  </button>
</header>
```

Replace it with:

```tsx
<Header
  onBrandClick={onBrandClick}
  onAbout={() => setInfoModal("about")}
  onLog={() => setInfoModal("log")}
  onMock={() => setMockMode(true)}
  onDraft={() => setToast("Live draft mode is coming soon!")}
/>
```

- [ ] **Step 4: Render the InfoModal**

Find the toast render near the end of the returned JSX:

```tsx
{
  toast && <div className="toast">{toast}</div>;
}
```

Insert directly above it:

```tsx
{
  infoModal && (
    <InfoModal
      title={infoModal === "about" ? <Wordmark /> : "What’s new"}
      onClose={() => setInfoModal(null)}
    >
      {infoModal === "about" ? <AboutContent /> : <LogContent />}
    </InfoModal>
  );
}
```

- [ ] **Step 5: Drop the Toolbar `onMock` prop**

In the `<Toolbar ... />` props, remove this line (Mock now lives in the Header):

```tsx
        onMock={() => setMockMode(true)}
```

- [ ] **Step 6: Verify type-check passes**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no type errors). If it reports `onMock` is a required Toolbar prop, that is fixed in Task 6 — proceed to Task 6 before the final build.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "Render Header and info modals in App"
```

---

## Task 6: Remove Mock from the Toolbar

**Files:**

- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/Toolbar.test.tsx`

- [ ] **Step 1: Remove the `onMock` prop from the Toolbar props type**

In `src/components/Toolbar.tsx`, delete this line from the props interface:

```tsx
  onMock: () => void;
```

- [ ] **Step 2: Remove the Mock menu item**

In the `SettingsMenu` children, delete the Mock button and its trailing separator:

```tsx
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onMock();
              }}
            >
              🏈 Mock draft…
            </button>
            <div className="menu-sep" />
```

The menu now opens straight into the `Leagues` label.

- [ ] **Step 3: Remove `onMock` from the Toolbar test props**

In `src/components/Toolbar.test.tsx`, delete the `onMock` entry from the props object passed to `renderToolbar` (e.g. `onMock: vi.fn(),` or `onMock: noop,`).

- [ ] **Step 4: Run the Toolbar tests**

Run: `pnpm test Toolbar`
Expected: PASS (no reference to `onMock`; no missing-prop type error).

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx src/components/Toolbar.test.tsx
git commit -m "Move Mock draft entry from Toolbar to Header"
```

---

## Task 7: Full verification

**Files:** none (verification + visual check).

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all tests PASS, including the new Header / InfoModal / infoContent suites.

- [ ] **Step 2: Production build (includes type-check)**

Run: `pnpm build`
Expected: `tsc --noEmit` clean, Vite build succeeds.

- [ ] **Step 3: Visual check against the mockup**

Run: `pnpm dev`, open the local URL. Confirm:

- Logo + `On The Clock.` with `draft day cheat sheet` centered beneath; small gap.
- `About` · `Log` underlined links after the divider; underline turns orange on hover.
- `Mock` (plain) and `Draft` (orange) buttons on the right.
- About / Log open the modal; ✕, backdrop, and Escape close it.
- `Mock` enters mock mode; `Draft` shows the "coming soon" toast.
- Mock draft is no longer in the Toolbar settings menu.
- The `QB/RB/WR…` counts row still renders below the header.

- [ ] **Step 4: Final review (no commit needed if clean)**

Run: `git log --oneline -7`
Expected: the header feature commits are present on `header-section`.

---

## Self-Review notes

- **Spec coverage:** Header component (T3), tagline (T3/T4), About+Log links → InfoModal (T1/T2/T5), Mock relocated (T5/T6), Draft placeholder toast (T5), counts row untouched (verified T7), styling reuses tokens (T4). All spec sections covered.
- **Type consistency:** `Header` prop names (`onBrandClick`, `onAbout`, `onLog`, `onMock`, `onDraft`) match between T3 and the call site in T5. `infoModal` state union `"about" | "log" | null` consistent in T5. `InfoModal` props (`title`, `onClose`, `children`) match between T1 and T5.
- **No placeholders:** every code step shows complete code.

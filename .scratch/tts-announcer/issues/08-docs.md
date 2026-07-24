# T8 — Change Log + README correction

**Blocks:** nothing · **Blocked by:** T7 · **Est:** S

1. `src/components/infoContent.tsx` — add a Change Log entry. Repo rule: every
   larger change or feature goes there as you go.

2. `README.md` line 23 — fix *"Nothing leaves your browser."*

   This is a **pre-existing bug**, not a cost of this feature. Already false
   today: `@vercel/analytics` at `main.tsx:33`, `/api/adp` fanning out to four
   providers, Formspree suggestions. Line 96's formal Privacy section is narrow,
   accurate, and needs no change.

   Rewrite line 23 to match line 96's real scope (your board data stays local),
   rather than claiming zero network activity.

Do not overstate the announcer in either doc. On The Clock has no real users —
dogfooding framing only.

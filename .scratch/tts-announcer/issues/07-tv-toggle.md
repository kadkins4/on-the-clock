# T7 — TV window announcer toggle

**Blocks:** T8 · **Blocked by:** T6 · **Est:** M

`TVStage.tsx` currently has **zero interactive elements**. This adds the first.

The toggle is doing double duty: it's the opt-in control **and** the
autoplay-unlock user gesture the TV window has never received (spec Finding A).

- Default **off**
- Visible affordance in the TV window when off (e.g. "Enable announcer")
- Persist the preference to `localStorage["otc:announcer"]`
- **But still require one click per TV window session** — a persisted
  preference does not satisfy the browser autoplay policy. Show the control
  until clicked regardless of stored preference.
- Respect the existing `localStorage["otc:muted"]` flag: muted -> silent.

TDD: render TVStage, assert the control exists, assert clicking enables, assert
muted suppresses.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { MockSetup } from "./MockSetup";
import type { League } from "../../types";

afterEach(cleanup);

function makeLeague(): League {
  return {
    id: "L",
    name: "Sunday Money",
    platform: "espn",
    scoring: "ppr",
    tePremium: false,
    teams: 12,
    roster: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      SUPERFLEX: 0,
      K: 1,
      DST: 1,
      bench: 6,
      disabled: [],
    },
    tierLists: [{ id: "tl", name: "Default", board: [] }],
    activeTierListId: "tl",
    defaultTierListId: "tl",
    updatedAt: 0,
  };
}

function renderSetup(over: Partial<Parameters<typeof MockSetup>[0]> = {}) {
  const onStart = vi.fn();
  const onCancel = vi.fn();
  const onSetValueFlags = vi.fn();
  render(
    <MockSetup
      league={makeLeague()}
      onStart={onStart}
      onCancel={onCancel}
      onSetValueFlags={onSetValueFlags}
      {...over}
    />,
  );
  return { onStart, onCancel, onSetValueFlags };
}

const openAdvanced = () =>
  fireEvent.click(screen.getByRole("button", { name: /advanced options/i }));

describe("MockSetup (Hero Card)", () => {
  it("shows the league name and the New Mock Draft eyebrow", () => {
    renderSetup();
    expect(screen.getByText("Sunday Money")).toBeTruthy();
    expect(screen.getByText(/new mock draft/i)).toBeTruthy();
  });

  it("renders one slot per team and defaults the user to slot 1", () => {
    renderSetup();
    const slots = screen.getAllByRole("button", { name: /draft slot/i });
    expect(slots).toHaveLength(12);
    expect(
      screen.getByRole("button", { name: /draft slot 1 \(you\)/i }),
    ).toBeTruthy();
  });

  it("selects a slot when clicked", () => {
    renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "Draft slot 5" }));
    const five = screen.getByRole("button", { name: /draft slot 5 \(you\)/i });
    expect(five.getAttribute("aria-pressed")).toBe("true");
  });

  it("clamps the user slot back into range when team count shrinks", () => {
    const { onStart } = renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "Draft slot 12" }));
    // drop teams 12 → 4 (eight clicks on decrease)
    const dec = screen.getByRole("button", { name: /decrease teams/i });
    for (let i = 0; i < 8; i++) fireEvent.click(dec);
    expect(screen.getAllByRole("button", { name: /draft slot/i })).toHaveLength(
      4,
    );
    fireEvent.click(screen.getByRole("button", { name: /start mock/i }));
    expect(onStart.mock.calls[0][0].userSlot).toBe(4);
  });

  it("passes rounds, scoring and roster overrides on start", () => {
    const { onStart, onSetValueFlags } = renderSetup();
    // scoring → Standard
    fireEvent.click(screen.getByRole("button", { name: "Standard" }));
    // rounds 15 → 14
    fireEvent.click(screen.getByRole("button", { name: /decrease rounds/i }));
    fireEvent.click(screen.getByRole("button", { name: /start mock/i }));

    expect(onSetValueFlags).toHaveBeenCalledOnce();
    const settings = onStart.mock.calls[0][0];
    expect(settings.scoring).toBe("standard");
    expect(settings.rounds).toBe(14);
    expect(settings.roster).toMatchObject({ QB: 1, RB: 2, WR: 2, bench: 6 });
    expect(settings.teams).toBe(12);
  });

  it("warns that a non-snake format will fall back to snake", () => {
    renderSetup();
    expect(screen.queryByText(/will run this mock/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Auction" }));
    expect(screen.getByText(/auction isn’t available yet/i)).toBeTruthy();
  });

  it("edits a roster spot count from the advanced section", () => {
    const { onStart } = renderSetup();
    openAdvanced();
    const rbCell = screen.getByText("RB").closest(".ms-rcell")!;
    fireEvent.click(
      within(rbCell as HTMLElement).getByRole("button", {
        name: /increase rb/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /start mock/i }));
    expect(onStart.mock.calls[0][0].roster.RB).toBe(3);
  });

  it("disables the coming-soon Super Flex and TE Premium switches", () => {
    renderSetup();
    openAdvanced();
    const sf = screen.getByRole("switch", { name: /super flex/i });
    const te = screen.getByRole("switch", { name: /te premium/i });
    expect((sf as HTMLButtonElement).disabled).toBe(true);
    expect((te as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides the value threshold until the value-flags switch is on", () => {
    renderSetup();
    openAdvanced();
    // default enabled → threshold visible; toggle off → hidden
    expect(screen.getByLabelText("Value threshold")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: /highlight reaches/i }));
    expect(screen.queryByLabelText("Value threshold")).toBeNull();
  });

  it("calls onCancel from the Cancel button", () => {
    const { onCancel } = renderSetup();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

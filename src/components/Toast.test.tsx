import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Toast } from "./Toast";

afterEach(cleanup);

describe("Toast", () => {
  it("renders nothing when there's no toast", () => {
    const { container } = render(<Toast toast={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the message with a kind class", () => {
    render(
      <Toast
        toast={{ message: "Renamed league", kind: "success" }}
        onDismiss={() => {}}
      />,
    );
    const el = screen.getByText("Renamed league");
    expect(el.className).toBe("toast toast-success");
  });

  it("dismisses on click", () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        toast={{ message: "Import failed", kind: "danger" }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByText("Import failed"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

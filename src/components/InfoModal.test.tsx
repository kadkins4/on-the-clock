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

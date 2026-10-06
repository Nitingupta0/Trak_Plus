import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StatusSelector } from "@/components/library/status-selector";

const MOVIE_STATUSES = ["watching", "plan_to", "completed", "dropped", "on_hold"] as const;

describe("StatusSelector", () => {
  it("renders a toggle for every allowed status", () => {
    render(
      <StatusSelector
        value="plan_to"
        options={[...MOVIE_STATUSES]}
        onChange={vi.fn()}
        testId="status-selector"
      />,
    );
    expect(screen.getByRole("button", { name: "Watching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan to" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Playing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reading" })).not.toBeInTheDocument();
  });

  it("marks the current value as selected", () => {
    render(
      <StatusSelector
        value="plan_to"
        options={[...MOVIE_STATUSES]}
        onChange={vi.fn()}
        testId="status-selector"
      />,
    );
    const planTo = screen.getByRole("button", { name: "Plan to" });
    // Base UI sets data-pressed="" on the pressed item and omits it otherwise.
    expect(planTo.getAttribute("data-pressed")).toBe("");
    expect(screen.getByRole("button", { name: "Watching" }).getAttribute("data-pressed")).not.toBe(
      "",
    );
  });

  it("calls onChange with the newly selected status", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StatusSelector
        value="plan_to"
        options={[...MOVIE_STATUSES]}
        onChange={onChange}
        testId="status-selector"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Completed" }));
    expect(onChange).toHaveBeenCalledWith("completed");
  });
});

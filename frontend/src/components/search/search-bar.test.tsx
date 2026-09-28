import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchBar } from "@/components/search/search-bar";

describe("SearchBar", () => {
  it("renders the input with placeholder", () => {
    render(<SearchBar onQueryChange={vi.fn()} placeholder="Search everything" />);
    expect(screen.getByRole("textbox", { name: "Search titles" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search everything")).toBeInTheDocument();
  });

  it("debounces input before notifying about query changes", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<SearchBar onQueryChange={onQueryChange} debounceMs={50} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "naruto");
    expect(onQueryChange).not.toHaveBeenCalledWith("naruto"); // still pending

    await waitFor(
      () => expect(onQueryChange).toHaveBeenCalledWith("naruto"),
      { timeout: 1000 },
    );
  });

  it("trims whitespace from the query", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<SearchBar onQueryChange={onQueryChange} debounceMs={10} />);

    await user.type(screen.getByRole("textbox"), "  one piece  ");
    await waitFor(() => expect(onQueryChange).toHaveBeenCalledWith("one piece"), {
      timeout: 1000,
    });
  });

  it("shows a pending spinner while debounce is running", async () => {
    const user = userEvent.setup();
    const { container } = render(<SearchBar onQueryChange={vi.fn()} debounceMs={5000} />);
    expect(container.querySelector(".animate-spin")).toBeNull();
    await user.type(screen.getByRole("textbox"), "x");
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});

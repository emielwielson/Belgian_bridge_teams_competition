import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "./SearchableSelect";

const options = [
  {
    value: "p1",
    label: "Alice Peeters (100)",
    searchText: "Peeters Alice Alice Peeters 100",
  },
  {
    value: "p2",
    label: "Bob Janssens (200)",
    searchText: "Janssens Bob Bob Janssens 200",
  },
  {
    value: "p3",
    label: "Carla Peeters",
    searchText: "Peeters Carla Carla Peeters",
  },
];

describe("SearchableSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters options by search text and selects a match", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={onChange}
        placeholder="Search player…"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const input = screen.getByRole("combobox");
    await user.type(input, "jans");

    expect(screen.getByRole("option", { name: /Bob Janssens/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Alice Peeters/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Bob Janssens/i }));
    expect(onChange).toHaveBeenCalledWith("p2");
  });

  it("matches member numbers in searchText", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={onChange}
        placeholder="Search player…"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "100");

    expect(screen.getByRole("option", { name: /Alice Peeters/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Bob Janssens/i })).not.toBeInTheDocument();
  });
});

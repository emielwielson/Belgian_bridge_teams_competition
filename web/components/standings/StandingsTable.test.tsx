import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StandingsTable } from "./StandingsTable";

describe("StandingsTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders ranked rows with VP", () => {
    render(
      <StandingsTable
        rows={[
          { team_name: "Bravo", vp_total: 120 },
          { team_name: "Alpha", vp_total: 100 },
        ]}
      />,
    );

    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows empty message when there are no rows", () => {
    render(<StandingsTable rows={[]} emptyMessage="Nothing yet." />);
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });
});

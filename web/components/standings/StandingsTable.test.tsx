import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StandingsTable, type StandingsTableLabels } from "./StandingsTable";

const labels: StandingsTableLabels = {
  rank: "#",
  team: "Team",
  vp: "VP",
  empty: "No scored matches yet.",
};

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
        labels={labels}
      />,
    );

    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows empty message when there are no rows", () => {
    render(<StandingsTable rows={[]} labels={labels} emptyMessage="Nothing yet." />);
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });
});

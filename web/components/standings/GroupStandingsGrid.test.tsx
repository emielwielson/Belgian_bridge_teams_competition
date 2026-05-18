import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GroupStandingsGridData } from "@/lib/competition/group-standings-grid";
import { GroupStandingsGrid } from "./GroupStandingsGrid";

const sampleGrid: GroupStandingsGridData = {
  hasMatches: true,
  rounds: [
    { round: 1, dateLabel: "04/10/24", timeLabel: "14:00" },
    { round: 2, dateLabel: "11/10/24", timeLabel: "14:00" },
  ],
  rows: [
    {
      rank: 1,
      teamId: "t1",
      teamName: "Alpha",
      vpTotal: 20,
      cells: [
        { vp: 14, isHome: true, pairingClass: "bg-sky-100", matchId: "m1" },
        { vp: null, isHome: false, pairingClass: "bg-amber-100", matchId: null },
      ],
    },
    {
      rank: 2,
      teamId: "t2",
      teamName: "Bravo",
      vpTotal: 12,
      cells: [
        { vp: 6, isHome: false, pairingClass: "bg-sky-100", matchId: null },
        { vp: 10, isHome: true, pairingClass: "bg-amber-100", matchId: "m2" },
      ],
    },
  ],
};

describe("GroupStandingsGrid", () => {
  afterEach(() => {
    cleanup();
  });

  it("links team names to the team page", () => {
    render(<GroupStandingsGrid grid={sampleGrid} />);
    const alphaLink = screen.getByRole("link", { name: "Alpha" });
    expect(alphaLink).toHaveAttribute("href", "/teams/t1");
    expect(screen.getByRole("link", { name: "Bravo" })).toHaveAttribute(
      "href",
      "/teams/t2",
    );
  });

  it("renders round headers and team rows", () => {
    render(<GroupStandingsGrid grid={sampleGrid} />);
    expect(screen.getByText("04/10/24")).toBeInTheDocument();
    expect(screen.getByText("11/10/24")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("shows home icon only for home cells", () => {
    render(<GroupStandingsGrid grid={sampleGrid} />);
    expect(screen.getAllByLabelText("Score match")).toHaveLength(2);
  });

  it("links home icons to the match scoring page", () => {
    render(<GroupStandingsGrid grid={sampleGrid} />);
    const links = screen.getAllByRole("link", { name: "Score match" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/player/matches/m1",
      "/player/matches/m2",
    ]);
  });

  it("applies pairing background classes to round cells", () => {
    const { container } = render(<GroupStandingsGrid grid={sampleGrid} />);
    expect(container.querySelector(".bg-sky-100")).toBeTruthy();
    expect(container.querySelector(".bg-amber-100")).toBeTruthy();
  });

  it("shows schedule message when there are no matches", () => {
    render(
      <GroupStandingsGrid
        grid={{ ...sampleGrid, hasMatches: false, rounds: [] }}
      />,
    );
    expect(
      screen.getByText(/round columns appear after the match schedule/i),
    ).toBeInTheDocument();
  });
});

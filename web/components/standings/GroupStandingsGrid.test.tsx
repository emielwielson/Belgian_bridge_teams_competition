import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GroupStandingsGridData } from "@/lib/competition/group-standings-grid";
import {
  GroupStandingsGrid,
  type GroupStandingsGridLabels,
} from "./GroupStandingsGrid";

const labels: GroupStandingsGridLabels = {
  rank: "#",
  team: "Team",
  vp: "VP",
  penaltyShort: "Pen.",
  noTeamsInGroup: "No teams in this group yet.",
  roundColumnsPending: "Round columns appear after the match schedule is generated.",
  viewMatchAria: "View match",
  homeAria: "Home",
};

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
      penaltyVp: 0,
      cells: [
        { vp: 14, isHome: true, pairingClass: "bg-sky-100", matchId: "m1", scheduledLabel: null },
        { vp: null, isHome: false, pairingClass: "bg-amber-100", matchId: null, scheduledLabel: null },
      ],
    },
    {
      rank: 2,
      teamId: "t2",
      teamName: "Bravo",
      vpTotal: 12,
      penaltyVp: 0,
      cells: [
        { vp: 6, isHome: false, pairingClass: "bg-sky-100", matchId: null, scheduledLabel: null },
        { vp: 10, isHome: true, pairingClass: "bg-amber-100", matchId: "m2", scheduledLabel: null },
      ],
    },
  ],
};

describe("GroupStandingsGrid", () => {
  afterEach(() => {
    cleanup();
  });

  it("links team names to the team page", () => {
    render(<GroupStandingsGrid grid={sampleGrid} labels={labels} />);
    const alphaLink = screen.getByRole("link", { name: "Alpha" });
    expect(alphaLink).toHaveAttribute("href", "/teams/t1");
    expect(screen.getByRole("link", { name: "Bravo" })).toHaveAttribute(
      "href",
      "/teams/t2",
    );
  });

  it("renders round headers and team rows", () => {
    render(<GroupStandingsGrid grid={sampleGrid} labels={labels} />);
    expect(screen.getByText("04/10/24")).toBeInTheDocument();
    expect(screen.getByText("11/10/24")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("links home icons to the public match page", () => {
    render(<GroupStandingsGrid grid={sampleGrid} labels={labels} />);
    const links = screen.getAllByRole("link", { name: "View match" });
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/matches/m1",
      "/matches/m2",
    ]);
  });

  it("applies pairing background classes to round cells", () => {
    const { container } = render(
      <GroupStandingsGrid grid={sampleGrid} labels={labels} />,
    );
    expect(container.querySelector(".bg-sky-100")).toBeTruthy();
    expect(container.querySelector(".bg-amber-100")).toBeTruthy();
  });

  it("shows schedule message when there are no matches", () => {
    render(
      <GroupStandingsGrid
        grid={{ ...sampleGrid, hasMatches: false, rounds: [] }}
        labels={labels}
      />,
    );
    expect(
      screen.getByText(/round columns appear after the match schedule/i),
    ).toBeInTheDocument();
  });
});

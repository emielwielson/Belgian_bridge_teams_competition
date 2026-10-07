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
  arbiterRequestAria: "Match has an arbiter request",
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
        { vp: 14, isHome: true, pairingClass: "bg-sky-200 text-sky-950", matchId: "m1", scheduledDateLabel: null, scheduledTimeLabel: null, hasArbiterRequest: true },
        { vp: null, isHome: false, pairingClass: "bg-amber-200 text-amber-950", matchId: null, scheduledDateLabel: null, scheduledTimeLabel: null, hasArbiterRequest: false },
      ],
    },
    {
      rank: 2,
      teamId: "t2",
      teamName: "Bravo",
      vpTotal: 12,
      penaltyVp: 0,
      cells: [
        { vp: 6, isHome: false, pairingClass: "bg-sky-200 text-sky-950", matchId: null, scheduledDateLabel: null, scheduledTimeLabel: null, hasArbiterRequest: true },
        { vp: 10, isHome: true, pairingClass: "bg-amber-200 text-amber-950", matchId: "m2", scheduledDateLabel: null, scheduledTimeLabel: null, hasArbiterRequest: false },
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
    expect(container.querySelector(".bg-sky-200")).toBeTruthy();
    expect(container.querySelector(".bg-amber-200")).toBeTruthy();
  });

  it("highlights cells with an arbiter request", () => {
    const { container } = render(
      <GroupStandingsGrid grid={sampleGrid} labels={labels} />,
    );
    expect(container.querySelector(".outline-amber-500")).toBeTruthy();
    expect(
      screen.getAllByTitle("Match has an arbiter request").length,
    ).toBeGreaterThanOrEqual(2);
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

  it("uses aligned sticky column layout classes", () => {
    const { container } = render(
      <GroupStandingsGrid grid={sampleGrid} labels={labels} />,
    );

    const mobilePenaltyCells = container.querySelectorAll(".left-\\[9rem\\]");
    const desktopPenaltyCells = container.querySelectorAll(
      ".sm\\:left-\\[11\\.5rem\\]",
    );
    const mobileVpCells = container.querySelectorAll(".left-\\[12rem\\]");
    const desktopVpCells = container.querySelectorAll(".sm\\:left-\\[15\\.5rem\\]");
    const mobileTeamCells = container.querySelectorAll(".w-\\[7rem\\]");
    const desktopTeamCells = container.querySelectorAll(".sm\\:w-\\[9rem\\]");

    expect(mobilePenaltyCells.length).toBeGreaterThanOrEqual(3);
    expect(desktopPenaltyCells.length).toBeGreaterThanOrEqual(3);
    expect(mobileVpCells.length).toBeGreaterThanOrEqual(3);
    expect(desktopVpCells.length).toBeGreaterThanOrEqual(3);
    expect(mobileTeamCells.length).toBeGreaterThanOrEqual(3);
    expect(desktopTeamCells.length).toBeGreaterThanOrEqual(3);

    for (const cell of mobileTeamCells) {
      expect(cell.className).not.toMatch(/min-w-\[9rem\]/);
    }

    const teamBodyCells = container.querySelectorAll("td.w-\\[7rem\\]");
    expect(teamBodyCells.length).toBeGreaterThanOrEqual(2);
    for (const cell of teamBodyCells) {
      expect(cell.className).toMatch(/max-w-\[7rem\]/);
      expect(cell.className).toMatch(/sm:max-w-\[9rem\]/);
    }
  });
});

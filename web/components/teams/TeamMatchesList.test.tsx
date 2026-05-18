import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TeamMatchRow } from "@/lib/competition/team-queries";
import { TeamMatchesList } from "./TeamMatchesList";

const played: TeamMatchRow = {
  id: "m1",
  round: 1,
  datetime: "2025-10-04T12:00:00Z",
  isHome: true,
  opponent: { id: "t2", name: "Bravo" },
  status: "played",
  teamVp: 14,
  opponentVp: 10,
};

const scheduled: TeamMatchRow = {
  id: "m2",
  round: 2,
  datetime: "2025-10-11T12:00:00Z",
  isHome: false,
  opponent: { id: "t3", name: "Charlie" },
  status: "scheduled",
  teamVp: null,
  opponentVp: null,
};

describe("TeamMatchesList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders played and scheduled matches", () => {
    render(
      <TeamMatchesList teamName="Alpha" matches={[played, scheduled]} />,
    );
    expect(screen.getByText("Played")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText(/Home vs/)).toBeInTheDocument();
    expect(screen.getByText(/Away at/)).toBeInTheDocument();
    expect(screen.getByText(/VP 14 – 10/)).toBeInTheDocument();
  });
});

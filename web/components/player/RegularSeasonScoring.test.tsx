import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegularSeasonScoring } from "./RegularSeasonScoring";

describe("RegularSeasonScoring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows message when player is not linked", () => {
    render(<RegularSeasonScoring linkedPlayerName={null} />);
    expect(screen.getByText(/not linked to a player profile/i)).toBeInTheDocument();
  });

  it("shows loading state initially when linked", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<RegularSeasonScoring linkedPlayerName="Alice" />);
    expect(screen.getByText(/Loading matches/i)).toBeInTheDocument();
  });
});

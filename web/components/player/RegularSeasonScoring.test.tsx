import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render-with-intl";
import { RegularSeasonScoring } from "./RegularSeasonScoring";

describe("RegularSeasonScoring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows message when player is not linked", () => {
    renderWithIntl(<RegularSeasonScoring linkedPlayerName={null} />);
    expect(screen.getByText(/not linked to a player profile/i)).toBeInTheDocument();
  });

  it("shows loading state initially when linked", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderWithIntl(<RegularSeasonScoring linkedPlayerName="Alice" />);
    expect(screen.getByText(/Loading matches/i)).toBeInTheDocument();
  });
});

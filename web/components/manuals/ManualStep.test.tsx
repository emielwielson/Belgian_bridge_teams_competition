import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { ManualStep } from "./ManualStep";
import { renderWithIntl } from "@/test/render-with-intl";

afterEach(() => {
  cleanup();
});

describe("ManualStep", () => {
  it("renders step number, title, body, and image when provided", () => {
    renderWithIntl(
      <ManualStep
        stepNumber={2}
        title="Save the home lineup"
        body="Select at least four players."
        imageSrc="/manuals/player-03-home-lineup.png"
        imageAlt="Home lineup"
      />,
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Save the home lineup" })).toBeInTheDocument();
    expect(screen.getByText("Select at least four players.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Home lineup" })).toHaveAttribute(
      "src",
      "/manuals/player-03-home-lineup.png",
    );
  });

  it("omits image when imageSrc is not set", () => {
    renderWithIntl(
      <ManualStep
        stepNumber={1}
        title="Open a match"
        body="Sign in first."
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

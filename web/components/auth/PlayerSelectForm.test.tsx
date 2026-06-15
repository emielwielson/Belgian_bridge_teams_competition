import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PlayerSelectForm } from "./PlayerSelectForm";
import { renderWithIntl } from "@/test/render-with-intl";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("PlayerSelectForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );
  });

  it("renders linked players and submits selection", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <PlayerSelectForm
        nextPath="/player"
        players={[
          {
            id: "p1",
            name: "Alice",
            member_number: "001",
            club_name: "Club A",
          },
          {
            id: "p2",
            name: "Bob",
            member_number: null,
            club_name: "Club B",
          },
        ]}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Bob/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/active-player",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ player_id: "p2" }),
      }),
    );
    expect(push).toHaveBeenCalledWith("/player");
  });
});

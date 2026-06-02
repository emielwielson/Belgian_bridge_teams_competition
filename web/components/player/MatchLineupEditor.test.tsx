import { cleanup, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render-with-intl";
import { MatchLineupEditor } from "./MatchLineupEditor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("./AddSubPicker", () => ({
  AddSubPicker: ({
    onSelect,
    onClose,
  }: {
    onSelect: (p: { id: string; name: string; member_number: null }) => void;
    onClose: () => void;
  }) => (
    <div data-testid="sub-picker">
      <button
        type="button"
        onClick={() =>
          onSelect({ id: "sub-1", name: "Club Sub", member_number: null })
        }
      >
        Pick sub
      </button>
      <button type="button" onClick={onClose}>
        Close picker
      </button>
    </div>
  ),
}));

describe("MatchLineupEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const roster = [
    { id: "p1", name: "Alice", member_number: "001" },
    { id: "p2", name: "Bob", member_number: "002" },
    { id: "p3", name: "Carol", member_number: "003" },
    { id: "p4", name: "Dave", member_number: "004" },
  ];

  it("does not show per-player Sub checkbox", () => {
    renderWithIntl(
      <MatchLineupEditor
        matchId="m1"
        teamId="t1"
        teamName="Home"
        roster={roster}
        initialLineup={[]}
        canEdit
      />,
    );
    expect(screen.queryByLabelText("Sub")).not.toBeInTheDocument();
  });

  it("adds substitute via + Sub and saves split payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithIntl(
      <MatchLineupEditor
        matchId="m1"
        teamId="t1"
        teamName="Home"
        roster={roster}
        initialLineup={[]}
        canEdit
      />,
    );

    const boxes = screen.getAllByRole("checkbox");
    for (let i = 0; i < 4; i++) {
      fireEvent.click(boxes[i]);
    }

    fireEvent.click(screen.getByRole("button", { name: "+ Sub" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick sub" }));

    expect(screen.getByText("Club Sub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save lineup/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/matches/m1/players",
      expect.objectContaining({
        method: "PUT",
        body: expect.any(String),
      }),
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.players.filter((p: { is_substitute: boolean }) => !p.is_substitute)).toHaveLength(4);
    expect(body.players.filter((p: { is_substitute: boolean }) => p.is_substitute)).toEqual([
      { player_id: "sub-1", is_substitute: true },
    ]);
  });
});

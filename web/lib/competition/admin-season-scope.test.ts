import { beforeEach, describe, expect, it, vi } from "vitest";
import { isGroupInActiveSeason } from "./admin-season-scope";

vi.mock("./season", () => ({
  requireActiveSeason: vi.fn(),
}));

import { requireActiveSeason } from "./season";

describe("isGroupInActiveSeason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveSeason).mockResolvedValue({
      id: "season-active",
      name: "2025-26",
      status: "live",
      is_active: true,
    });
  });

  it("returns true when the group's league is the active season", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "group-1",
        division: {
          league: { season_id: "season-active" },
        },
      },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      })),
    };

    await expect(
      isGroupInActiveSeason(supabase as never, "group-1"),
    ).resolves.toBe(true);
  });

  it("returns false when the group's league is another season", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "group-1",
        division: {
          league: { season_id: "season-old" },
        },
      },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      })),
    };

    await expect(
      isGroupInActiveSeason(supabase as never, "group-1"),
    ).resolves.toBe(false);
  });

  it("returns false when the group is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      })),
    };

    await expect(
      isGroupInActiveSeason(supabase as never, "missing"),
    ).resolves.toBe(false);
  });
});

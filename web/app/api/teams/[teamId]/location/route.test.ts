import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

vi.mock("@/lib/auth/team-access", () => ({
  assertCanManageTeamLocation: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(),
}));

import { AuthError, requireAuth } from "@/lib/auth/route-auth";
import { assertCanManageTeamLocation } from "@/lib/auth/team-access";
import { createServiceClient } from "@/lib/supabase/server-client";

type TeamRow = {
  id: string;
  club_id: string;
  club: {
    id: string;
    name: string;
    address: string | null;
    postal_code: string | null;
    location: string | null;
    competition_location: string | null;
  };
  group: {
    id: string;
    division: { centralized_location: string | null };
  };
};

function mockSessionSupabase(team: TeamRow | null) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "teams") throw new Error(`Unexpected table ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: team,
              error: null,
            })),
          })),
        })),
      };
    }),
  };
}

function mockServiceClient(updated: { id: string; location: string | null }) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "teams") throw new Error(`Unexpected table ${table}`);
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: updated,
                error: null,
              })),
            })),
          })),
        })),
      };
    }),
  };
}

const baseTeam: TeamRow = {
  id: "team-1",
  club_id: "club-1",
  club: {
    id: "club-1",
    name: "Club A",
    address: "Street 1",
    postal_code: "1000",
    location: "Brussels",
    competition_location: null,
  },
  group: {
    id: "group-1",
    division: { centralized_location: null },
  },
};

describe("PATCH /api/teams/[teamId]/location", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: mockSessionSupabase(baseTeam) as never,
    });
    vi.mocked(assertCanManageTeamLocation).mockResolvedValue(undefined);
    vi.mocked(createServiceClient).mockReturnValue(
      mockServiceClient({ id: "team-1", location: "Custom hall" }) as never,
    );
  });

  it("requires authentication", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError("Unauthorized", 401));

    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({ location: "Custom hall" }),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when assert fails", async () => {
    vi.mocked(assertCanManageTeamLocation).mockRejectedValue(
      new AuthError("Forbidden: cannot manage location for this team", 403),
    );

    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "Custom hall" }),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when team is missing", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: mockSessionSupabase(null) as never,
    });

    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "Custom hall" }),
      }),
      { params: Promise.resolve({ teamId: "missing" }) },
    );
    expect(res.status).toBe(404);
  });

  it("rejects when division has a centralized venue", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: mockSessionSupabase({
        ...baseTeam,
        group: {
          id: "group-1",
          division: { centralized_location: "Honor hall" },
        },
      }) as never,
    });

    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "Custom hall" }),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/centralized/i);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("sets a team location override", async () => {
    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "  Custom hall  " }),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.location).toBe("Custom hall");
    expect(body.locationOverride).toBe("Custom hall");
    expect(body.clubLocation).toBe("Street 1 - 1000 - Brussels");
    expect(assertCanManageTeamLocation).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["player"],
      "team-1",
      "club-1",
    );
  });

  it("clears override back to club location", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      mockServiceClient({ id: "team-1", location: null }) as never,
    );

    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: null }),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.location).toBe("Street 1 - 1000 - Brussels");
    expect(body.locationOverride).toBeNull();
  });

  it("treats empty string as clear", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      mockServiceClient({ id: "team-1", location: null }) as never,
    );

    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "   " }),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locationOverride).toBeNull();
  });

  it("rejects missing location field", async () => {
    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );
    expect(res.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

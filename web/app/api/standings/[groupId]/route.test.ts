import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/supabase/server-client", () => ({
  createPublicClient: vi.fn(),
}));

vi.mock("@/lib/competition/standings-queries", () => ({
  fetchGroupStandings: vi.fn(),
}));

import { createPublicClient } from "@/lib/supabase/server-client";
import { fetchGroupStandings } from "@/lib/competition/standings-queries";

describe("GET /api/standings/[groupId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPublicClient).mockReturnValue({} as never);
  });

  it("returns standings for group without auth", async () => {
    vi.mocked(fetchGroupStandings).mockResolvedValue([
      { team_id: "t1", team_name: "Alpha", vp_total: 100 },
      { team_id: "t2", team_name: "Beta", vp_total: 50 },
    ]);

    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ groupId: "g1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.standings).toHaveLength(2);
    expect(body.groupId).toBe("g1");
  });
});

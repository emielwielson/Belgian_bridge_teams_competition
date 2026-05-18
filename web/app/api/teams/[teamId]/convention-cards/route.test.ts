import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

vi.mock("@/lib/auth/team-access", () => ({
  assertCanManageTeamConventionCards: vi.fn(),
}));

vi.mock("@/lib/competition/convention-card-queries", () => ({
  listConventionCards: vi.fn(),
}));

vi.mock("@/lib/files/convention-card-upload", () => ({
  validateConventionCardFile: vi.fn(),
  sanitizeConventionCardFilename: vi.fn(() => "doc.pdf"),
  conventionCardStoragePath: vi.fn(() => "team/card/doc.pdf"),
}));

vi.mock("@/lib/files/convention-card-storage", () => ({
  uploadConventionCardFile: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createSessionClient: vi.fn(),
  createServiceClient: vi.fn(() => ({
    storage: { from: vi.fn() },
  })),
}));

import { AuthError, requireAuth } from "@/lib/auth/route-auth";
import { assertCanManageTeamConventionCards } from "@/lib/auth/team-access";
import { listConventionCards } from "@/lib/competition/convention-card-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

const sampleCards = [
  {
    id: "card-1",
    name: "System A",
    file_mime: "application/pdf",
    file_size_bytes: 100,
    updated_at: "2025-01-01T12:00:00Z",
    download_url: "/api/teams/t1/convention-cards/card-1/download",
  },
];

describe("GET /api/teams/[teamId]/convention-cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSessionClient).mockResolvedValue({} as never);
    vi.mocked(listConventionCards).mockResolvedValue(sampleCards);
  });

  it("returns cards without authentication", async () => {
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ teamId: "team-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].name).toBe("System A");
  });
});

describe("POST /api/teams/[teamId]/convention-cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    vi.mocked(requireAuth).mockRejectedValue(
      new AuthError("Unauthorized", 401),
    );

    const formData = new FormData();
    formData.set("name", "Test");
    formData.set("file", new File(["x"], "a.pdf", { type: "application/pdf" }));

    const res = await POST(
      new Request("http://test", { method: "POST", body: formData }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

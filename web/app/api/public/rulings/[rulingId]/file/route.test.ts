import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { ErrorCodes } from "@/lib/http/error-codes";

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/server-client";

describe("GET /api/public/rulings/[rulingId]/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when ruling is missing", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as never);

    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ rulingId: "missing" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: ErrorCodes.api.rulingNotFound,
    });
  });

  it("redirects to a URL ending with the display filename", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "ruling-1",
                file_path: "rulings/m1/uuid.pdf",
                file_name: "Board 3 Ruling.pdf",
              },
              error: null,
            }),
          })),
        })),
      })),
    } as never);

    const res = await GET(new Request("http://localhost/api/public/rulings/ruling-1/file"), {
      params: Promise.resolve({ rulingId: "ruling-1" }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      "http://localhost/api/public/rulings/ruling-1/Board%203%20Ruling.pdf",
    );
  });
});

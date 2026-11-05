import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { ErrorCodes } from "@/lib/http/error-codes";

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/files/operational-file-storage", () => ({
  downloadOperationalFile: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/server-client";
import { downloadOperationalFile } from "@/lib/files/operational-file-storage";

describe("GET /api/public/rulings/[rulingId]/[fileName]", () => {
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
      params: Promise.resolve({
        rulingId: "missing",
        fileName: "doc.pdf",
      }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: ErrorCodes.api.rulingNotFound,
    });
  });

  it("streams the file inline using the DB file_name", async () => {
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
    vi.mocked(downloadOperationalFile).mockResolvedValue({
      data: new Blob([new Uint8Array([1, 2, 3])], {
        type: "application/pdf",
      }),
      contentType: "application/pdf",
    });

    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({
        rulingId: "ruling-1",
        fileName: "Board%203%20Ruling.pdf",
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="Board 3 Ruling.pdf"',
    );
    expect(downloadOperationalFile).toHaveBeenCalledWith(
      expect.anything(),
      "rulings/m1/uuid.pdf",
    );
  });
});

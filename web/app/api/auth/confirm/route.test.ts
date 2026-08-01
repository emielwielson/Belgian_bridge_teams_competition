import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { ErrorCodes } from "@/lib/http/error-codes";

const verifyOtp = vi.fn();
const getUser = vi.fn();
const getUserPreferredLocale = vi.fn();
const resolvePostLoginPlayerSelection = vi.fn();
const getPlayerSelectionState = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      getUser: (...args: unknown[]) => getUser(...args),
    },
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublicEnv: () => ({
    url: "http://supabase.test",
    publishableKey: "test-key",
  }),
}));

vi.mock("@/lib/i18n/user-locale", () => ({
  getUserPreferredLocale: (...args: unknown[]) =>
    getUserPreferredLocale(...args),
}));

vi.mock("@/lib/auth/active-player", () => ({
  resolvePostLoginPlayerSelection: (...args: unknown[]) =>
    resolvePostLoginPlayerSelection(...args),
  getPlayerSelectionState: (...args: unknown[]) =>
    getPlayerSelectionState(...args),
}));

describe("POST /api/auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getUserPreferredLocale.mockResolvedValue(null);
    resolvePostLoginPlayerSelection.mockResolvedValue(undefined);
    getPlayerSelectionState.mockResolvedValue({ needsSelection: false });
  });

  it("returns 400 when token_hash is missing", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/confirm", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(ErrorCodes.api.invalidRequestBody);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("verifies token_hash and returns redirectTo", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await POST(
      new NextRequest("http://localhost/api/auth/confirm", {
        method: "POST",
        headers: { cookie: "auth_next=%2Fplayer" },
        body: JSON.stringify({
          token_hash: "abc123",
          type: "email",
        }),
      }),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "abc123",
      type: "email",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("http://localhost/player");
  });

  it("returns 400 when verifyOtp fails", async () => {
    verifyOtp.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/auth/confirm", {
        method: "POST",
        body: JSON.stringify({ token_hash: "bad", type: "email" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expired|invalid/i);
  });
});

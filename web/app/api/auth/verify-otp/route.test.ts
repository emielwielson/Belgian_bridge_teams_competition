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

describe("POST /api/auth/verify-otp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getUserPreferredLocale.mockResolvedValue(null);
    resolvePostLoginPlayerSelection.mockResolvedValue(undefined);
    getPlayerSelectionState.mockResolvedValue({ needsSelection: false });
  });

  it("returns 400 for non-8-digit token", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: "player@example.com",
          token: "123456",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(ErrorCodes.api.invalidRequestBody);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("verifies 8-digit OTP and returns redirectTo", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await POST(
      new NextRequest("http://localhost/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: "player@example.com",
          token: "12345678",
        }),
      }),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "player@example.com",
      token: "12345678",
      type: "email",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("http://localhost/");
  });
});

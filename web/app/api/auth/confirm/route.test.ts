import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { ErrorCodes } from "@/lib/http/error-codes";
import { AUTH_COOKIE_MAX_AGE_SECONDS } from "@/lib/supabase/middleware";

const verifyOtp = vi.fn();
const getUser = vi.fn();
const getUserPreferredLocale = vi.fn();
const resolvePostLoginPlayerSelection = vi.fn();
const getPlayerSelectionState = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookies: { name: string; value: string; options?: object }[],
        ) => void;
      };
    },
  ) => ({
    auth: {
      verifyOtp: async (...args: unknown[]) => {
        const result = await verifyOtp(...args);
        if (!result?.error) {
          options.cookies.setAll([
            {
              name: "sb-test-auth-token",
              value: "session-payload",
              options: {
                path: "/",
                sameSite: "lax",
                maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
              },
            },
          ]);
        }
        return result;
      },
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

function setCookieHeader(res: Response): string {
  const headers = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().join("\n");
  }
  return res.headers.get("set-cookie") ?? "";
}

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

  it("copies auth cookies onto JSON with Max-Age so they survive browser close", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await POST(
      new NextRequest("http://localhost/api/auth/confirm", {
        method: "POST",
        body: JSON.stringify({
          token_hash: "abc123",
          type: "email",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const header = setCookieHeader(res);
    expect(header).toMatch(/sb-test-auth-token=session-payload/i);
    expect(header).toMatch(new RegExp(`Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}`, "i"));
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

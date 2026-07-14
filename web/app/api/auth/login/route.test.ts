import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { ErrorCodes } from "@/lib/http/error-codes";

const isEmailAllowedForLogin = vi.fn();
const createServiceClient = vi.fn();
const signInWithOtp = vi.fn();

vi.mock("@/lib/auth/login-email", () => ({
  isEmailAllowedForLogin: (...args: unknown[]) => isEmailAllowedForLogin(...args),
  isValidLoginEmailFormat: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  normalizeLoginEmail: (email: string) => email.trim().toLowerCase(),
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: () => createServiceClient(),
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServiceClient.mockReturnValue({
      auth: { signInWithOtp },
    });
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(isEmailAllowedForLogin).not.toHaveBeenCalled();
  });

  it("returns 404 when email is not registered", async () => {
    isEmailAllowedForLogin.mockResolvedValue(false);

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "unknown@example.com" }),
      }),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe(ErrorCodes.auth.emailNotRegistered);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends magic link for allowed email", async () => {
    isEmailAllowedForLogin.mockResolvedValue(true);
    signInWithOtp.mockResolvedValue({ error: null });

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "player@example.com",
          next: "/player",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "player@example.com",
      options: {
        emailRedirectTo:
          "http://localhost/auth/callback?next=%2Fplayer",
      },
    });
  });

  it("propagates Supabase OTP errors", async () => {
    isEmailAllowedForLogin.mockResolvedValue(true);
    signInWithOtp.mockResolvedValue({
      error: { message: "Rate limited", status: 429 },
    });

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "player@example.com" }),
      }),
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Rate limited");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { ErrorCodes } from "@/lib/http/error-codes";

const isEmailAllowedForLogin = vi.fn();
const ensureAuthUserForLogin = vi.fn();
const createServiceClient = vi.fn();
const signInWithOtp = vi.fn();
const getLocale = vi.fn();

const env = process.env;

vi.mock("next-intl/server", () => ({
  getLocale: () => getLocale(),
}));

vi.mock("@/lib/auth/login-email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/login-email")>();
  return {
    ...actual,
    isEmailAllowedForLogin: (...args: unknown[]) => isEmailAllowedForLogin(...args),
    ensureAuthUserForLogin: (...args: unknown[]) =>
      ensureAuthUserForLogin(...args),
    isValidLoginEmailFormat: (email: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    normalizeLoginEmail: (email: string) => email.trim().toLowerCase(),
  };
});

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: () => createServiceClient(),
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocale.mockResolvedValue("en");
    process.env = {
      ...env,
      NEXT_PUBLIC_APP_URL: "https://belgian-interclub.wielson.be",
    };
    createServiceClient.mockReturnValue({
      auth: { signInWithOtp },
    });
    ensureAuthUserForLogin.mockResolvedValue(undefined);
  });

  it("falls back to request origin when NEXT_PUBLIC_APP_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

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
        emailRedirectTo: "http://localhost/auth/confirm",
        shouldCreateUser: false,
      },
    });
    expect(ensureAuthUserForLogin).toHaveBeenCalledWith(
      expect.anything(),
      "player@example.com",
      "en",
    );
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
    expect(ensureAuthUserForLogin).toHaveBeenCalledWith(
      expect.anything(),
      "player@example.com",
      "en",
    );
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "player@example.com",
      options: {
        emailRedirectTo: "https://belgian-interclub.wielson.be/auth/confirm",
        shouldCreateUser: false,
      },
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/auth_next=%2Fplayer/);
  });

  it("uses body locale when valid", async () => {
    isEmailAllowedForLogin.mockResolvedValue(true);
    signInWithOtp.mockResolvedValue({ error: null });
    getLocale.mockResolvedValue("en");

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "player@example.com",
          locale: "nl",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(ensureAuthUserForLogin).toHaveBeenCalledWith(
      expect.anything(),
      "player@example.com",
      "nl",
    );
  });

  it("falls back to getLocale when body locale is invalid", async () => {
    isEmailAllowedForLogin.mockResolvedValue(true);
    signInWithOtp.mockResolvedValue({ error: null });
    getLocale.mockResolvedValue("fr");

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "player@example.com",
          locale: "de",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(ensureAuthUserForLogin).toHaveBeenCalledWith(
      expect.anything(),
      "player@example.com",
      "fr",
    );
  });

  it("maps Supabase signup disabled errors to emailNotRegistered", async () => {
    isEmailAllowedForLogin.mockResolvedValue(true);
    signInWithOtp.mockResolvedValue({
      error: {
        message: "Signups not allowed for this instance",
        code: "otp_disabled",
        status: 422,
      },
    });

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "unknown@example.com" }),
      }),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe(ErrorCodes.auth.emailNotRegistered);
  });

  it("propagates other Supabase OTP errors", async () => {
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

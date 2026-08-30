import { describe, expect, it, vi } from "vitest";
import {
  ensureAuthUserForLogin,
  isEmailAllowedForLogin,
  isEmailNotRegisteredError,
  isSignupNotAllowedAuthError,
  isValidLoginEmailFormat,
  normalizeLoginEmail,
  resolveLoginEmailLocale,
} from "./login-email";

function createSupabaseMock(options: {
  players?: { email: string | null }[];
  users?: {
    id: string;
    email: string | null;
    user_metadata?: Record<string, unknown>;
  }[];
  rolesByUserId?: Record<string, string[]>;
}) {
  const listUsers = vi.fn().mockResolvedValue({
    data: { users: options.users ?? [] },
    error: null,
  });
  const createUser = vi.fn().mockResolvedValue({ error: null });
  const updateUserById = vi.fn().mockResolvedValue({ error: null });

  return {
    auth: {
      admin: { listUsers, createUser, updateUserById },
    },
    from: vi.fn((table: string) => {
      if (table === "players") {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: options.players ?? [],
            error: null,
          }),
        };
      }
      if (table === "user_roles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(function (this: { userId?: string }, _col: string, userId: string) {
            this.userId = userId;
            return this;
          }),
          limit: vi.fn(function (this: { userId?: string }) {
            const roles = options.rolesByUserId?.[this.userId ?? ""] ?? [];
            return Promise.resolve({
              data: roles.map((role) => ({ role })),
              error: null,
            });
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("normalizeLoginEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeLoginEmail("  Test@Example.com  ")).toBe(
      "test@example.com",
    );
  });
});

describe("isValidLoginEmailFormat", () => {
  it("accepts valid emails", () => {
    expect(isValidLoginEmailFormat("user@example.com")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidLoginEmailFormat("not-an-email")).toBe(false);
    expect(isValidLoginEmailFormat("")).toBe(false);
  });
});

describe("isSignupNotAllowedAuthError", () => {
  it("detects Supabase signup disabled errors", () => {
    expect(
      isSignupNotAllowedAuthError({
        message: "Signups not allowed for this instance",
      }),
    ).toBe(true);
    expect(
      isSignupNotAllowedAuthError({
        code: "otp_disabled",
        message: "Signups not allowed for otp",
      }),
    ).toBe(true);
    expect(isSignupNotAllowedAuthError({ message: "Rate limited" })).toBe(
      false,
    );
  });
});

describe("isEmailNotRegisteredError", () => {
  it("detects error codes and Supabase signup messages", () => {
    expect(isEmailNotRegisteredError("auth.emailNotRegistered")).toBe(true);
    expect(
      isEmailNotRegisteredError("Signups not allowed for this instance"),
    ).toBe(true);
    expect(isEmailNotRegisteredError("Rate limited")).toBe(false);
  });
});

describe("resolveLoginEmailLocale", () => {
  it("prefers valid body locale", () => {
    expect(resolveLoginEmailLocale("nl", "en")).toBe("nl");
  });

  it("falls back when body locale is invalid", () => {
    expect(resolveLoginEmailLocale("de", "fr")).toBe("fr");
  });

  it("defaults to en when both are invalid", () => {
    expect(resolveLoginEmailLocale("de", "xx")).toBe("en");
  });
});

describe("ensureAuthUserForLogin", () => {
  it("creates user with locale metadata for new users", async () => {
    const supabase = createSupabaseMock({ users: [] });

    await ensureAuthUserForLogin(supabase as never, "new@example.com", "nl");

    expect(supabase.auth.admin.createUser).toHaveBeenCalledWith({
      email: "new@example.com",
      email_confirm: true,
      user_metadata: { locale: "nl" },
    });
    expect(supabase.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("updates locale metadata for existing users", async () => {
    const supabase = createSupabaseMock({
      users: [
        {
          id: "user-1",
          email: "player@example.com",
          user_metadata: { role: "captain" },
        },
      ],
    });

    await ensureAuthUserForLogin(supabase as never, "player@example.com", "fr");

    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith("user-1", {
      user_metadata: { role: "captain", locale: "fr" },
    });
    expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });
});

describe("isEmailAllowedForLogin", () => {
  it("allows email on a player record", async () => {
    const supabase = createSupabaseMock({
      players: [{ email: "Player@Example.com" }],
    });

    await expect(
      isEmailAllowedForLogin(supabase as never, "player@example.com"),
    ).resolves.toBe(true);
  });

  it("allows email for auth user with assigned role", async () => {
    const supabase = createSupabaseMock({
      players: [],
      users: [{ id: "user-1", email: "staff@example.com" }],
      rolesByUserId: { "user-1": ["system_admin"] },
    });

    await expect(
      isEmailAllowedForLogin(supabase as never, "staff@example.com"),
    ).resolves.toBe(true);
  });

  it("denies unknown email", async () => {
    const supabase = createSupabaseMock({
      players: [],
      users: [{ id: "user-1", email: "other@example.com" }],
      rolesByUserId: { "user-1": ["system_admin"] },
    });

    await expect(
      isEmailAllowedForLogin(supabase as never, "unknown@example.com"),
    ).resolves.toBe(false);
  });

  it("denies auth user without roles when not on player record", async () => {
    const supabase = createSupabaseMock({
      players: [],
      users: [{ id: "user-1", email: "orphan@example.com" }],
      rolesByUserId: {},
    });

    await expect(
      isEmailAllowedForLogin(supabase as never, "orphan@example.com"),
    ).resolves.toBe(false);
  });
});

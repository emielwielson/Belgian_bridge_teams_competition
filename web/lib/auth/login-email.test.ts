import { describe, expect, it, vi } from "vitest";
import {
  isEmailAllowedForLogin,
  isValidLoginEmailFormat,
  normalizeLoginEmail,
} from "./login-email";

function createSupabaseMock(options: {
  players?: { email: string | null }[];
  users?: { id: string; email: string | null }[];
  rolesByUserId?: Record<string, string[]>;
}) {
  const listUsers = vi.fn().mockResolvedValue({
    data: { users: options.users ?? [] },
    error: null,
  });

  return {
    auth: { admin: { listUsers } },
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

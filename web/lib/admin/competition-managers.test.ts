import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/auth-error";
import type { CompetitionKindCode } from "@/lib/auth/competition-scope";

vi.mock("@/lib/auth/login-email", () => ({
  ensureAuthUserForLogin: vi.fn().mockResolvedValue(undefined),
  normalizeLoginEmail: (email: string) => email.trim().toLowerCase(),
  isValidLoginEmailFormat: (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
}));

vi.mock("@/lib/auth/competition-scope", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/auth/competition-scope")
  >("@/lib/auth/competition-scope");
  return {
    ...actual,
    resolveCompetitionKindId: vi.fn(async (_service: unknown, code: string) => {
      const ids: Record<string, string> = {
        national: "kind-national",
        flanders: "kind-flanders",
        wallonia: "kind-wallonia",
        zweiffel: "kind-zweiffel",
      };
      return ids[code] ?? `kind-${code}`;
    }),
  };
});

import {
  createOrEnsureCompetitionManager,
  parseKindCodes,
  removeCompetitionManager,
  updateCompetitionManagerScopes,
  validateManagerScopeInput,
} from "@/lib/admin/competition-managers";
import { ensureAuthUserForLogin } from "@/lib/auth/login-email";

type ScopeRow = {
  user_id: string;
  competition_kind_id: string;
  kind?: { code: string } | { code: string }[];
};

function createServiceMock(options: {
  userId?: string;
  email?: string;
  hasManagerRole?: boolean;
  scopes?: ScopeRow[];
}) {
  const userId = options.userId ?? "user-1";
  const email = options.email ?? "manager@example.com";
  let scopes = [...(options.scopes ?? [])];
  let hasManagerRole = options.hasManagerRole ?? false;
  const upsertedRoles: { user_id: string; role: string }[] = [];
  const deletedRoles: { user_id: string; role: string }[] = [];

  const service = {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [{ id: userId, email }] },
          error: null,
        }),
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { id: userId, email } },
          error: null,
        }),
      },
    },
    from: vi.fn((table: string) => {
      if (table === "user_roles") {
        return {
          upsert: vi.fn(async (row: { user_id: string; role: string }) => {
            upsertedRoles.push(row);
            hasManagerRole = true;
            return { error: null };
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn(async () => ({
                  data: hasManagerRole ? { user_id: userId } : null,
                  error: null,
                })),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn(async (_col: string, role: string) => {
                deletedRoles.push({ user_id: userId, role });
                hasManagerRole = false;
                return { error: null };
              }),
            }),
          }),
        };
      }

      if (table === "competition_manager_scopes") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn(async (_col: string, value: string) => ({
              data: scopes
                .filter((s) => s.user_id === value)
                .map((s) => ({
                  competition_kind_id: s.competition_kind_id,
                  kind: s.kind ?? {
                    code:
                      s.competition_kind_id.replace("kind-", "") || "unknown",
                  },
                })),
              error: null,
            })),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn(async (_col: string, value: string) => {
              scopes = scopes.filter((s) => s.user_id !== value);
              return { error: null };
            }),
          }),
          upsert: vi.fn(
            async (row: {
              user_id: string;
              competition_kind_id: string;
            }) => {
              scopes.push({
                ...row,
                kind: {
                  code: row.competition_kind_id.replace("kind-", ""),
                },
              });
              return { error: null };
            },
          ),
        };
      }

      if (table === "player_auth_links") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === "user_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { user_id: userId, display_name: "Test Manager" },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    _state: {
      get scopes() {
        return scopes;
      },
      get upsertedRoles() {
        return upsertedRoles;
      },
      get deletedRoles() {
        return deletedRoles;
      },
      get hasManagerRole() {
        return hasManagerRole;
      },
    },
  };

  return service;
}

describe("parseKindCodes", () => {
  it("accepts known codes and drops junk", () => {
    expect(
      parseKindCodes(["flanders", "nope", "national", "zweiffel", "flanders"]),
    ).toEqual(["flanders", "national", "zweiffel"]);
    expect(parseKindCodes(null)).toEqual([]);
  });
});

describe("validateManagerScopeInput", () => {
  it("returns empty kinds for global", () => {
    expect(
      validateManagerScopeInput(true, ["zweiffel"] as CompetitionKindCode[]),
    ).toEqual([]);
  });

  it("requires at least one kind when not global", () => {
    expect(() => validateManagerScopeInput(false, [])).toThrow(AuthError);
  });

  it("returns kinds when scoped", () => {
    expect(validateManagerScopeInput(false, ["zweiffel", "flanders"])).toEqual([
      "zweiffel",
      "flanders",
    ]);
  });
});

describe("createOrEnsureCompetitionManager", () => {
  beforeEach(() => {
    vi.mocked(ensureAuthUserForLogin).mockClear();
  });

  it("creates a global manager with zero scope rows", async () => {
    const service = createServiceMock({
      email: "coupezweiffel@bbbw.be",
    });
    const result = await createOrEnsureCompetitionManager({
      service: service as never,
      email: "coupezweiffel@bbbw.be",
      displayName: "Coupe Zweiffel",
      kinds: ["zweiffel"],
      isGlobal: true,
    });

    expect(ensureAuthUserForLogin).toHaveBeenCalled();
    expect(service._state.upsertedRoles).toEqual([
      { user_id: "user-1", role: "competition_manager" },
    ]);
    expect(service._state.scopes).toEqual([]);
    expect(result.isGlobal).toBe(true);
    expect(result.kinds).toEqual([]);
    expect(result.email).toBe("coupezweiffel@bbbw.be");
  });

  it("creates a scoped manager with kind rows", async () => {
    const service = createServiceMock({});
    const result = await createOrEnsureCompetitionManager({
      service: service as never,
      email: "manager@example.com",
      displayName: "Manager Example",
      kinds: ["zweiffel", "flanders"],
      isGlobal: false,
    });

    expect(result.isGlobal).toBe(false);
    expect(result.kinds).toEqual(["flanders", "zweiffel"]);
    expect(
      service._state.scopes.map((s) => s.competition_kind_id).sort(),
    ).toEqual(["kind-flanders", "kind-zweiffel"]);
  });

  it("rejects scoped create with no kinds", async () => {
    const service = createServiceMock({});
    await expect(
      createOrEnsureCompetitionManager({
        service: service as never,
        email: "manager@example.com",
        displayName: "Manager Example",
        kinds: [],
        isGlobal: false,
      }),
    ).rejects.toThrow(AuthError);
  });
});

describe("updateCompetitionManagerScopes", () => {
  it("toggles from scoped to global by clearing scopes", async () => {
    const service = createServiceMock({
      hasManagerRole: true,
      scopes: [
        {
          user_id: "user-1",
          competition_kind_id: "kind-zweiffel",
          kind: { code: "zweiffel" },
        },
      ],
    });

    const result = await updateCompetitionManagerScopes({
      service: service as never,
      userId: "user-1",
      kinds: [],
      isGlobal: true,
    });

    expect(result.isGlobal).toBe(true);
    expect(result.kinds).toEqual([]);
    expect(service._state.scopes).toEqual([]);
    expect(service._state.hasManagerRole).toBe(true);
  });

  it("toggles from global to scoped", async () => {
    const service = createServiceMock({
      hasManagerRole: true,
      scopes: [],
    });

    const result = await updateCompetitionManagerScopes({
      service: service as never,
      userId: "user-1",
      kinds: ["national"],
      isGlobal: false,
    });

    expect(result.isGlobal).toBe(false);
    expect(result.kinds).toEqual(["national"]);
    expect(service._state.scopes).toHaveLength(1);
  });
});

describe("removeCompetitionManager", () => {
  it("deletes scopes and the competition_manager role", async () => {
    const service = createServiceMock({
      hasManagerRole: true,
      scopes: [
        {
          user_id: "user-1",
          competition_kind_id: "kind-zweiffel",
          kind: { code: "zweiffel" },
        },
      ],
    });

    await removeCompetitionManager({
      service: service as never,
      userId: "user-1",
    });

    expect(service._state.scopes).toEqual([]);
    expect(service._state.deletedRoles).toEqual([
      { user_id: "user-1", role: "competition_manager" },
    ]);
  });
});

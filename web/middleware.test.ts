import { describe, expect, it } from "vitest";
import {
  isPublicPath,
  requiredRolesForPath,
} from "./lib/auth/middleware-routes";
import { ROLES } from "./lib/auth/roles";

describe("isPublicPath", () => {
  it("allows home, login, callback, health", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it("allows public APIs and standings", () => {
    expect(isPublicPath("/api/public/active-season")).toBe(true);
    expect(isPublicPath("/api/public/groups")).toBe(true);
    expect(isPublicPath("/api/standings/abc")).toBe(true);
    expect(isPublicPath("/standings")).toBe(true);
    expect(isPublicPath("/standings/group-1")).toBe(true);
    expect(isPublicPath("/teams/team-1")).toBe(true);
  });

  it("denies protected dashboards", () => {
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/player")).toBe(false);
  });
});

describe("requiredRolesForPath", () => {
  it("maps admin to competition manager and system admin", () => {
    expect(requiredRolesForPath("/admin")).toEqual([
      ROLES.SYSTEM_ADMIN,
      ROLES.COMPETITION_MANAGER,
    ]);
    expect(requiredRolesForPath("/admin/users")).toEqual([
      ROLES.SYSTEM_ADMIN,
      ROLES.COMPETITION_MANAGER,
    ]);
  });

  it("maps role dashboards", () => {
    expect(requiredRolesForPath("/player")).toEqual([ROLES.PLAYER]);
    expect(requiredRolesForPath("/captain")).toEqual([ROLES.CAPTAIN]);
    expect(requiredRolesForPath("/club-manager")).toEqual([ROLES.CLUB_MANAGER]);
    expect(requiredRolesForPath("/arbiter")).toEqual([ROLES.ARBITER]);
  });

  it("returns null for unguarded paths", () => {
    expect(requiredRolesForPath("/unknown")).toBeNull();
  });
});

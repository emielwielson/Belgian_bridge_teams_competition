import { ARBITER_ACCESS_ROLES, ROLES } from "./roles";
import { COMPETITION_ADMIN_ROLES } from "./route-auth";

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/auth/callback",
  "/auth/select-player",
  "/api/health",
  "/api/auth/me",
  "/api/auth/signout",
  "/api/cron/award-bye-scores",
]);

const PUBLIC_PREFIXES = ["/api/public/", "/standings", "/teams", "/matches"];

const ROLE_ROUTES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: [ROLES.SYSTEM_ADMIN, ROLES.COMPETITION_MANAGER] },
  { prefix: "/players", roles: [...COMPETITION_ADMIN_ROLES] },
  { prefix: "/player", roles: [ROLES.PLAYER] },
  { prefix: "/arbiter", roles: [...ARBITER_ACCESS_ROLES] },
];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname === "/api/standings" || pathname.startsWith("/api/standings/")) {
    return true;
  }
  if (/^\/api\/teams\/[^/]+\/convention-cards/.test(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Roles required for path, or null if not a protected role route. */
export function requiredRolesForPath(pathname: string): string[] | null {
  for (const { prefix, roles } of ROLE_ROUTES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return roles;
    }
  }
  return null;
}

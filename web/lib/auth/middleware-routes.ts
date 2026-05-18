import { ROLES } from "./roles";

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/auth/callback",
  "/api/health",
  "/api/auth/me",
  "/api/auth/signout",
  "/api/cron/award-bye-scores",
]);

const PUBLIC_PREFIXES = ["/api/public/", "/standings", "/teams"];

const ROLE_ROUTES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: [ROLES.SYSTEM_ADMIN, ROLES.COMPETITION_MANAGER] },
  { prefix: "/player", roles: [ROLES.PLAYER] },
  { prefix: "/captain", roles: [ROLES.CAPTAIN] },
  { prefix: "/club-manager", roles: [ROLES.CLUB_MANAGER] },
  { prefix: "/arbiter", roles: [ROLES.ARBITER] },
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

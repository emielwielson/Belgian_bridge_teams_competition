/** Cookie that preserves the post-login path across Magic Link (emailRedirectTo has no query). */
export const AUTH_NEXT_COOKIE = "auth_next";

const AUTH_NEXT_MAX_AGE_SECONDS = 60 * 60; // 1 hour

export function safeNextPath(next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

export function authNextCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_NEXT_MAX_AGE_SECONDS,
  };
}

export function clearAuthNextCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function localeCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: LOCALE_COOKIE_MAX_AGE,
  };
}

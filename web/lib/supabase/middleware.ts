import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "./env";

/**
 * Refresh the Supabase auth session cookies for this request.
 * Must run on (almost) every matched request so access tokens stay valid
 * even when the user only browses public pages.
 *
 * Return type is inferred so `.from(...).select(...)` stays typed for callers.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, response, user };
}

/** Match @supabase/ssr default cookie lifetime (~400 days). */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Copy Set-Cookie headers onto another response.
 * Next.js getAll() often omits maxAge; without it the browser treats the cookie
 * as a session cookie and drops it when the browser closes.
 */
export function copyCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    const { name, value, ...rest } = cookie;
    to.cookies.set(name, value, {
      ...rest,
      path: rest.path ?? "/",
      sameSite: rest.sameSite ?? "lax",
      maxAge:
        rest.maxAge !== undefined
          ? rest.maxAge
          : value === ""
            ? 0
            : AUTH_COOKIE_MAX_AGE_SECONDS,
    });
  });
}

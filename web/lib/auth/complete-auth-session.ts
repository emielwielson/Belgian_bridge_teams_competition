import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_NEXT_COOKIE,
  clearAuthNextCookieOptions,
  safeNextPath,
} from "@/lib/auth/auth-next";
import { finishPostLoginRedirect } from "@/lib/auth/post-login";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createAuthRouteSupabase(
  request: NextRequest,
  response: NextResponse,
): SupabaseClient {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

export function resolvePostLoginNext(
  request: NextRequest,
  nextOverride?: string | null,
): string {
  if (nextOverride != null && nextOverride !== "") {
    return safeNextPath(nextOverride);
  }
  return safeNextPath(request.cookies?.get(AUTH_NEXT_COOKIE)?.value ?? null);
}

export function clearAuthNextCookie(response: NextResponse): void {
  response.cookies.set(AUTH_NEXT_COOKIE, "", clearAuthNextCookieOptions());
}

/**
 * After verifyOtp / exchangeCodeForSession succeeded on `supabase` (cookies
 * already applied to `response`), finish locale + player selection and redirect.
 */
export async function redirectAfterAuthSession(
  request: NextRequest,
  supabase: SupabaseClient,
  response: NextResponse,
  next: string,
): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  clearAuthNextCookie(response);
  return finishPostLoginRedirect(supabase, origin, next, response);
}

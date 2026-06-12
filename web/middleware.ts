import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicPath,
  requiredRolesForPath,
} from "@/lib/auth/middleware-routes";
import { hasAnyRole } from "@/lib/auth/roles";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { defaultLocale, isLocale, type Locale } from "./i18n/config";
import {
  LOCALE_COOKIE,
  localeCookieOptions,
} from "@/lib/i18n/locale-cookie";

function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    if (tag.startsWith("nl")) return "nl";
    if (tag.startsWith("fr")) return "fr";
    if (tag.startsWith("en")) return "en";
  }
  return null;
}

/** Persist detected locale in a cookie without URL rewrites. */
function applyLocaleCookie(request: NextRequest, response: NextResponse) {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (existing && isLocale(existing)) {
    return;
  }

  const detected =
    localeFromAcceptLanguage(request.headers.get("accept-language")) ??
    defaultLocale;

  response.cookies.set(LOCALE_COOKIE, detected, localeCookieOptions());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    applyLocaleCookie(request, response);
    return response;
  }

  const requiredRoles = requiredRolesForPath(pathname);
  if (!requiredRoles) {
    const response = NextResponse.next();
    applyLocaleCookie(request, response);
    return response;
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, publishableKey, {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    applyLocaleCookie(request, redirect);
    return redirect;
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = roleRows?.map((row) => row.role) ?? [];

  if (pathname.startsWith("/player/matches/")) {
    applyLocaleCookie(request, response);
    return response;
  }

  if (!hasAnyRole(roles, requiredRoles)) {
    const home = request.nextUrl.clone();
    home.pathname = "/standings";
    home.searchParams.set("error", "forbidden");
    const redirect = NextResponse.redirect(home);
    applyLocaleCookie(request, redirect);
    return redirect;
  }

  applyLocaleCookie(request, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

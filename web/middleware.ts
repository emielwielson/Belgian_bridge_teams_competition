import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthOnlyPath,
  isPublicPath,
  requiredRolesForPath,
} from "@/lib/auth/middleware-routes";
import { hasAnyRole } from "@/lib/auth/roles";
import {
  copyCookies,
  updateSession,
} from "@/lib/supabase/middleware";
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
  const { supabase, response, user } = await updateSession(request);

  applyLocaleCookie(request, response);

  if (isPublicPath(pathname)) {
    return response;
  }

  const requiredRoles = requiredRolesForPath(pathname);
  const authOnly = isAuthOnlyPath(pathname);

  if (!requiredRoles && !authOnly) {
    return response;
  }

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    copyCookies(response, redirect);
    applyLocaleCookie(request, redirect);
    return redirect;
  }

  if (authOnly && !requiredRoles) {
    return response;
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = roleRows?.map((row) => row.role) ?? [];

  if (pathname.startsWith("/player/matches/")) {
    return response;
  }

  if (!requiredRoles) {
    return response;
  }

  if (!hasAnyRole(roles, requiredRoles)) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.searchParams.set("error", "forbidden");
    const redirect = NextResponse.redirect(home);
    copyCookies(response, redirect);
    applyLocaleCookie(request, redirect);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicPath,
  requiredRolesForPath,
} from "@/lib/auth/middleware-routes";
import {
  canAccessClubManagerRoute,
  isClubManagerPath,
} from "@/lib/auth/user-access";
import { hasAnyRole } from "@/lib/auth/roles";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const localeCookieName = "NEXT_LOCALE";

function copyIntlCookies(from: NextResponse, to: NextResponse) {
  const localeCookie = from.cookies.get(localeCookieName);
  if (!localeCookie) {
    return;
  }

  const cookieOptions =
    typeof routing.localeCookie === "object"
      ? Object.fromEntries(
          Object.entries(routing.localeCookie).filter(([key]) => key !== "name"),
        )
      : {};

  to.cookies.set(localeCookieName, localeCookie.value, {
    path: "/",
    ...cookieOptions,
  });
}

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return intlResponse;
  }

  const requiredRoles = requiredRolesForPath(pathname);
  if (!requiredRoles) {
    return intlResponse;
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
    copyIntlCookies(intlResponse, redirect);
    return redirect;
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = roleRows?.map((row) => row.role) ?? [];

  if (isClubManagerPath(pathname)) {
    const allowed = await canAccessClubManagerRoute(
      supabase,
      user.id,
      roles,
      pathname,
    );
    if (!allowed) {
      const home = request.nextUrl.clone();
      home.pathname = "/";
      home.searchParams.set("error", "forbidden");
      const redirect = NextResponse.redirect(home);
      copyIntlCookies(intlResponse, redirect);
      return redirect;
    }

    if (pathname === "/club-manager") {
      const { data: assignments } = await supabase
        .from("club_manager_assignments")
        .select("club_id")
        .eq("user_id", user.id);

      if (assignments?.length === 1) {
        const clubUrl = request.nextUrl.clone();
        clubUrl.pathname = `/club-manager/${assignments[0].club_id}`;
        const redirect = NextResponse.redirect(clubUrl);
        copyIntlCookies(intlResponse, redirect);
        return redirect;
      }
    }

    copyIntlCookies(intlResponse, response);
    return response;
  }

  if (pathname.startsWith("/player/matches/")) {
    copyIntlCookies(intlResponse, response);
    return response;
  }

  if (!hasAnyRole(roles, requiredRoles)) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.searchParams.set("error", "forbidden");
    const redirect = NextResponse.redirect(home);
    copyIntlCookies(intlResponse, redirect);
    return redirect;
  }

  copyIntlCookies(intlResponse, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

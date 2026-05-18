import { createServerClient } from "@supabase/ssr";
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const requiredRoles = requiredRolesForPath(pathname);
  if (!requiredRoles) {
    return NextResponse.next();
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
    return NextResponse.redirect(loginUrl);
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
      return NextResponse.redirect(home);
    }

    if (pathname === "/club-manager") {
      const { data: assignments } = await supabase
        .from("club_manager_assignments")
        .select("club_id")
        .eq("user_id", user.id);

      if (assignments?.length === 1) {
        const clubUrl = request.nextUrl.clone();
        clubUrl.pathname = `/club-manager/${assignments[0].club_id}`;
        return NextResponse.redirect(clubUrl);
      }
    }

    return response;
  }

  if (!hasAnyRole(roles, requiredRoles)) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.searchParams.set("error", "forbidden");
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

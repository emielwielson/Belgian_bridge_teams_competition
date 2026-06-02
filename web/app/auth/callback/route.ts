import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, localeCookieOptions } from "@/lib/i18n/locale-cookie";
import { getUserPreferredLocale } from "@/lib/i18n/user-locale";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const redirect = NextResponse.redirect(`${origin}${safeNext}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const preferred = await getUserPreferredLocale(supabase, user.id);
      if (preferred) {
        redirect.cookies.set(LOCALE_COOKIE, preferred, localeCookieOptions());
      }
    } catch {
      // Login succeeds even if profile locale cannot be loaded.
    }
  }

  return redirect;
}

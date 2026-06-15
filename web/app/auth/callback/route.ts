import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  getPlayerSelectionState,
  resolvePostLoginPlayerSelection,
} from "@/lib/auth/active-player";
import { LOCALE_COOKIE, localeCookieOptions } from "@/lib/i18n/locale-cookie";
import { getUserPreferredLocale } from "@/lib/i18n/user-locale";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function safeNextPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!token_hash && !code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  let redirectPath = next;
  let response = NextResponse.redirect(`${origin}${redirectPath}`);
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

  let error: { message: string } | null = null;

  if (token_hash && type) {
    const result = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    error = result.error;
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  }

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const preferred = await getUserPreferredLocale(supabase, user.id);
      if (preferred) {
        response.cookies.set(LOCALE_COOKIE, preferred, localeCookieOptions());
      }
    } catch {
      // Login succeeds even if profile locale cannot be loaded.
    }

    try {
      await resolvePostLoginPlayerSelection(supabase, user.id);
      const state = await getPlayerSelectionState(supabase, user.id);
      if (state.needsSelection) {
        redirectPath = `/auth/select-player?next=${encodeURIComponent(next)}`;
      }
    } catch {
      // Login succeeds even if player linking cannot be resolved.
    }
  }

  if (redirectPath !== next) {
    const redirectResponse = NextResponse.redirect(`${origin}${redirectPath}`);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return response;
}

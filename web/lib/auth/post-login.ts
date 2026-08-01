import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getPlayerSelectionState,
  resolvePostLoginPlayerSelection,
} from "@/lib/auth/active-player";
import { LOCALE_COOKIE, localeCookieOptions } from "@/lib/i18n/locale-cookie";
import { getUserPreferredLocale } from "@/lib/i18n/user-locale";

/**
 * After a session is established (verifyOtp / exchangeCodeForSession), set locale
 * cookie and resolve player selection, then return the redirect response.
 */
export async function finishPostLoginRedirect(
  supabase: SupabaseClient,
  origin: string,
  next: string,
  response: NextResponse,
): Promise<NextResponse> {
  let redirectPath = next;

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

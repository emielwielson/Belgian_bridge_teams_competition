"use server";

import { cookies } from "next/headers";
import { isLocale } from "@/i18n/config";
import { LOCALE_COOKIE, localeCookieOptions } from "@/lib/i18n/locale-cookie";
import {
  getUserPreferredLocale,
  setUserPreferredLocale,
} from "@/lib/i18n/user-locale";
import { createSessionClient } from "@/lib/supabase/server-client";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) {
    return { ok: false as const };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, localeCookieOptions());

  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await setUserPreferredLocale(supabase, user.id, locale);
    }
  } catch {
    // Cookie is set; profile sync can retry on next change.
  }

  return { ok: true as const };
}

/** Sync cookie from stored profile when the user has no locale cookie yet. */
export async function syncLocaleFromProfile() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(LOCALE_COOKIE)?.value;
  if (existing && isLocale(existing)) {
    return { ok: true as const, locale: existing };
  }

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const };
  }

  const preferred = await getUserPreferredLocale(supabase, user.id);
  if (!preferred) {
    return { ok: false as const };
  }

  cookieStore.set(LOCALE_COOKIE, preferred, localeCookieOptions());
  return { ok: true as const, locale: preferred };
}

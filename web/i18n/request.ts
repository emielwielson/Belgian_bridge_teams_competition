import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "./config";
import { getUserPreferredLocale } from "@/lib/i18n/user-locale";
import { createSessionClient } from "@/lib/supabase/server-client";

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

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const preferred = await getUserPreferredLocale(supabase, user.id);
      if (preferred) {
        return preferred;
      }
    }
  } catch {
    // Fall back to browser language when auth/profile is unavailable.
  }

  return (
    localeFromAcceptLanguage((await headers()).get("accept-language")) ??
    defaultLocale
  );
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

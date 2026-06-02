import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "./config";

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = (await headers()).get("accept-language");
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const tag = part.split(";")[0]?.trim().toLowerCase();
      if (!tag) continue;
      if (tag.startsWith("nl")) return "nl";
      if (tag.startsWith("fr")) return "fr";
      if (tag.startsWith("en")) return "en";
    }
  }

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

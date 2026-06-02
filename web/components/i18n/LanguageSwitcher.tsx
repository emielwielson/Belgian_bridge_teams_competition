"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { setLocale, syncLocaleFromProfile } from "@/app/actions/set-locale";
import { locales, type Locale } from "@/i18n/config";

const localeLabelKey: Record<Locale, "english" | "dutch" | "french"> = {
  en: "english",
  nl: "dutch",
  fr: "french",
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("nav.language");
  const router = useRouter();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    const hasCookie = document.cookie
      .split(";")
      .some((part) => part.trim().startsWith("NEXT_LOCALE="));

    if (hasCookie) return;

    syncLocaleFromProfile().then((result) => {
      if (result.ok && result.locale && result.locale !== locale) {
        router.refresh();
      }
    });
  }, [locale, router]);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    await setLocale(event.target.value);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor="locale-switcher"
        className="text-xs font-medium text-zinc-500"
      >
        {t("label")}
      </label>
      <select
        id="locale-switcher"
        value={locale}
        onChange={handleChange}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-800 shadow-sm"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {t(localeLabelKey[code])}
          </option>
        ))}
      </select>
    </div>
  );
}

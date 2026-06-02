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

type Props = {
  id?: string;
};

export function LanguageSelect({ id = "locale-switcher" }: Props) {
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
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-500">
        {t("label")}
      </label>
      <select
        id={id}
        value={locale}
        onChange={handleChange}
        className="w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
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

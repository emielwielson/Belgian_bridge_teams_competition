"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { setLocale } from "@/app/actions/set-locale";
import { localeLabels, locales } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    await setLocale(event.target.value);
    router.refresh();
  }

  return (
    <label className="sr-only" htmlFor="locale-switcher">
      Language
      <select
        id="locale-switcher"
        value={locale}
        onChange={handleChange}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

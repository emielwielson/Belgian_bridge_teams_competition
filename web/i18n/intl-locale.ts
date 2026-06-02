import type { Locale } from "./config";

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  nl: "nl-BE",
  fr: "fr-BE",
};

export function toIntlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}

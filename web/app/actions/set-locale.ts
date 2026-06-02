"use server";

import { cookies } from "next/headers";
import { isLocale } from "@/i18n/config";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, { path: "/" });
}

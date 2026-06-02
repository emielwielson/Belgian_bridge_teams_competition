import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocale, type Locale } from "@/i18n/config";

export async function getUserPreferredLocale(
  supabase: SupabaseClient,
  userId: string,
): Promise<Locale | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("preferred_locale")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  const locale = data?.preferred_locale;
  return locale && isLocale(locale) ? locale : null;
}

export async function setUserPreferredLocale(
  supabase: SupabaseClient,
  userId: string,
  locale: Locale,
): Promise<void> {
  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      preferred_locale: locale,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

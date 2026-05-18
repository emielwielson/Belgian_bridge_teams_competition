import type { SupabaseClient } from "@supabase/supabase-js";

export type Season = {
  id: string;
  name: string;
  status: string;
  is_active: boolean;
};

export async function getActiveSeason(
  supabase: SupabaseClient,
): Promise<Season | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, status, is_active")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function requireActiveSeason(supabase: SupabaseClient): Promise<Season> {
  const season = await getActiveSeason(supabase);
  if (!season) {
    throw new Error("No active season configured");
  }
  return season;
}

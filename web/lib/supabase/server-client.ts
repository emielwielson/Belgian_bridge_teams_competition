import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseSecretKey } from "./env";

export function createServerClient() {
  const { url } = getSupabasePublicEnv();
  return createClient(url, getSupabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

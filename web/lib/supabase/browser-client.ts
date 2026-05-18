import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

export function createBrowserClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient(url, publishableKey);
}

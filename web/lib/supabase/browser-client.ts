import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

export function createBrowserClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createSupabaseBrowserClient(url, publishableKey);
}

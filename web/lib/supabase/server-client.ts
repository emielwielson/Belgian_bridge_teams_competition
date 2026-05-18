import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicEnv, getSupabaseSecretKey } from "./env";

/** Publishable key + cookies — RLS-aware; default for auth and APIs. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnv();

  return createSupabaseServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component — cookie writes may be read-only
        }
      },
    },
  });
}

/** Secret key — bypasses RLS; health checks and guarded admin scripts only. */
export function createServiceClient() {
  const { url } = getSupabasePublicEnv();
  return createClient(url, getSupabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** @deprecated Use createServiceClient */
export function createServerClient() {
  return createServiceClient();
}

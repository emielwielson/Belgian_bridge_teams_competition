import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveHonorGroup } from "@/lib/competition/honor-seating-overview";

export async function resolvePublicHonorGroup(client: SupabaseClient) {
  return resolveActiveHonorGroup(client);
}

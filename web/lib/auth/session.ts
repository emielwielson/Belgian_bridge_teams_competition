import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server-client";

export async function getUser(
  supabase?: SupabaseClient,
): Promise<User | null> {
  const client = supabase ?? (await createSessionClient());
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getUserRoles(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw error;
  return data?.map((row) => row.role) ?? [];
}

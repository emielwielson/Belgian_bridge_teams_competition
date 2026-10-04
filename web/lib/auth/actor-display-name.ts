import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve a staff display label for attribution.
 * Prefer admin-managed user_profiles.display_name, then linked player, then email.
 */
export async function resolveActorDisplayName(
  service: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await service
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  const fromProfile =
    typeof profile?.display_name === "string"
      ? profile.display_name.trim()
      : "";
  if (fromProfile) return fromProfile;

  const { data: links } = await service
    .from("player_auth_links")
    .select("player:players(name)")
    .eq("auth_user_id", userId)
    .limit(1);
  const link = links?.[0];
  if (link) {
    const raw = link.player as unknown;
    const player = Array.isArray(raw) ? raw[0] : raw;
    const name = (player as { name?: string } | null)?.name?.trim();
    if (name) return name;
  }

  const { data: authData } = await service.auth.admin.getUserById(userId);
  const email = authData.user?.email?.trim();
  return email || null;
}

/** Upsert admin-managed display name on user_profiles. */
export async function upsertUserDisplayName(
  service: SupabaseClient,
  userId: string,
  displayName: string,
): Promise<void> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error("Display name is required");
  }

  const updatedAt = new Date().toISOString();
  const { data: existing, error: loadError } = await service
    .from("user_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw loadError;

  if (existing) {
    const { error } = await service
      .from("user_profiles")
      .update({ display_name: trimmed, updated_at: updatedAt })
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await service.from("user_profiles").insert({
    user_id: userId,
    display_name: trimmed,
    preferred_locale: "en",
    updated_at: updatedAt,
  });
  if (error) throw error;
}

export async function loadUserDisplayName(
  service: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await service
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const name =
    typeof data?.display_name === "string" ? data.display_name.trim() : "";
  return name || null;
}

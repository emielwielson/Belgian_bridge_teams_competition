import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveSeason } from "@/lib/competition/season";

export type LinkedPlayer = {
  id: string;
  name: string;
  member_number: string | null;
  club_name: string | null;
};

export type ActivePlayer = {
  id: string;
  name: string;
  member_number: string | null;
};

export async function syncPlayerAuthLinks(
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.rpc("sync_player_auth_links");
  if (error) throw error;
}

export async function setActivePlayer(
  supabase: SupabaseClient,
  playerId: string,
): Promise<void> {
  const { error } = await supabase.rpc("set_active_player", {
    p_player_id: playerId,
  });
  if (error) throw error;
}

export async function getActivePlayerId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("active_player_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  const activePlayerId = data?.active_player_id;
  if (!activePlayerId) return null;

  const { data: link, error: linkError } = await supabase
    .from("player_auth_links")
    .select("player_id")
    .eq("auth_user_id", userId)
    .eq("player_id", activePlayerId)
    .maybeSingle();

  if (linkError) throw linkError;
  return link ? activePlayerId : null;
}

export async function getActivePlayer(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActivePlayer | null> {
  const playerId = await getActivePlayerId(supabase, userId);
  if (!playerId) return null;

  const { data, error } = await supabase
    .from("players")
    .select("id, name, member_number")
    .eq("id", playerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    member_number: data.member_number,
  };
}

export async function requireActivePlayer(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActivePlayer> {
  const player = await getActivePlayer(supabase, userId);
  if (!player) {
    throw new Error("No active player profile");
  }
  return player;
}

export async function getLinkedPlayerCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("player_auth_links")
    .select("player_id", { count: "exact", head: true })
    .eq("auth_user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

export async function getLinkedPlayers(
  supabase: SupabaseClient,
  userId: string,
): Promise<LinkedPlayer[]> {
  const { data: links, error } = await supabase
    .from("player_auth_links")
    .select("player_id, player:players(id, name, member_number)")
    .eq("auth_user_id", userId);

  if (error) throw error;
  if (!links?.length) return [];

  const season = await getActiveSeason(supabase);
  const playerIds = links
    .map((row) => {
      const raw = row.player as unknown;
      const player = Array.isArray(raw) ? raw[0] : raw;
      return (player as { id: string } | null)?.id ?? row.player_id;
    })
    .filter(Boolean);

  const clubByPlayer = new Map<string, string>();
  if (season && playerIds.length > 0) {
    const { data: memberships, error: membershipError } = await supabase
      .from("player_club_memberships")
      .select("player_id, club:clubs(name)")
      .eq("season_id", season.id)
      .in("player_id", playerIds);

    if (membershipError) throw membershipError;

    for (const row of memberships ?? []) {
      const raw = row.club as unknown;
      const club = Array.isArray(raw) ? raw[0] : raw;
      const name = (club as { name: string } | null)?.name;
      if (name) clubByPlayer.set(row.player_id, name);
    }
  }

  const players: LinkedPlayer[] = [];
  for (const row of links) {
    const raw = row.player as unknown;
    const player = Array.isArray(raw) ? raw[0] : raw;
    if (!player) continue;
    const p = player as {
      id: string;
      name: string;
      member_number: string | null;
    };
    players.push({
      id: p.id,
      name: p.name,
      member_number: p.member_number,
      club_name: clubByPlayer.get(p.id) ?? null,
    });
  }

  return players.sort((a, b) => a.name.localeCompare(b.name));
}

export type PlayerSelectionState = {
  linkedCount: number;
  activePlayerId: string | null;
  needsSelection: boolean;
};

export async function getPlayerSelectionState(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlayerSelectionState> {
  const [linkedCount, activePlayerId] = await Promise.all([
    getLinkedPlayerCount(supabase, userId),
    getActivePlayerId(supabase, userId),
  ]);

  return {
    linkedCount,
    activePlayerId,
    needsSelection: linkedCount > 1 && !activePlayerId,
  };
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      preferred_locale: "en",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function resolvePostLoginPlayerSelection(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await ensureUserProfile(supabase, userId);
  await syncPlayerAuthLinks(supabase);

  const state = await getPlayerSelectionState(supabase, userId);
  if (state.linkedCount === 1 && !state.activePlayerId) {
    const linked = await getLinkedPlayers(supabase, userId);
    if (linked[0]) {
      await setActivePlayer(supabase, linked[0].id);
    }
  }
}

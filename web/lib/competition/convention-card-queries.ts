import type { SupabaseClient } from "@supabase/supabase-js";
import { CONVENTION_CARDS_BUCKET } from "@/lib/files/convention-card-upload";

export type ConventionCardRow = {
  id: string;
  team_id: string;
  name: string;
  storage_path: string;
  file_mime: string;
  file_size_bytes: number;
  updated_at: string;
};

export type ConventionCardListItem = {
  id: string;
  name: string;
  file_mime: string;
  file_size_bytes: number;
  updated_at: string;
  download_url: string;
};

export function conventionCardDownloadPath(teamId: string, cardId: string): string {
  return `/api/teams/${teamId}/convention-cards/${cardId}/download`;
}

export function mapConventionCardToListItem(
  card: Pick<
    ConventionCardRow,
    "id" | "name" | "file_mime" | "file_size_bytes" | "updated_at"
  >,
  teamId: string,
): ConventionCardListItem {
  return {
    id: card.id,
    name: card.name,
    file_mime: card.file_mime,
    file_size_bytes: card.file_size_bytes,
    updated_at: card.updated_at,
    download_url: conventionCardDownloadPath(teamId, card.id),
  };
}

export async function listConventionCards(
  supabase: SupabaseClient,
  teamId: string,
): Promise<ConventionCardListItem[]> {
  const { data, error } = await supabase
    .from("team_convention_cards")
    .select("id, name, file_mime, file_size_bytes, updated_at")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapConventionCardToListItem(row, teamId));
}

export async function getConventionCard(
  supabase: SupabaseClient,
  teamId: string,
  cardId: string,
): Promise<ConventionCardRow | null> {
  const { data, error } = await supabase
    .from("team_convention_cards")
    .select(
      "id, team_id, name, storage_path, file_mime, file_size_bytes, updated_at",
    )
    .eq("id", cardId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function getConventionCardPublicUrl(
  supabase: SupabaseClient,
  storagePath: string,
): string {
  const { data } = supabase.storage
    .from(CONVENTION_CARDS_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

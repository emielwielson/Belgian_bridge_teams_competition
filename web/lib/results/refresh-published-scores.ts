/**
 * After arbiter edits, refresh match IMPs/VPs when the round is already published.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadHonorRoundSeating,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import {
  applyHonorRoundMatchScores,
  type HonorPublishedMatchScore,
} from "@/lib/scoring/honor-match-imps";

export type RefreshMatchScoresResult =
  | { refreshed: true; scores: HonorPublishedMatchScore[] }
  | { refreshed: false; reason: string };

export async function maybeRefreshPublishedMatchScores(
  service: SupabaseClient,
  params: {
    groupId: string;
    tournamentRound: number;
    userId?: string | null;
  },
): Promise<RefreshMatchScoresResult> {
  const { data: publication } = await service
    .from("honor_round_publication")
    .select("status")
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound)
    .maybeSingle();

  if (publication?.status !== "published") {
    return { refreshed: false, reason: "round_not_published" };
  }

  const group = await resolveActiveHonorGroup(service);
  if (!group || group.id !== params.groupId) {
    return { refreshed: false, reason: "honor_group_not_found" };
  }

  const seating = await loadHonorRoundSeating(
    service,
    group,
    params.tournamentRound,
  );

  const scored = await applyHonorRoundMatchScores(service, {
    groupId: params.groupId,
    tournamentRound: params.tournamentRound,
    matches: seating.matches,
    userId: params.userId ?? null,
  });

  if (!scored.ok) {
    return { refreshed: false, reason: scored.error };
  }

  const now = new Date().toISOString();
  await service
    .from("honor_board_results")
    .update({ processing_status: "published", updated_at: now })
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound);

  return { refreshed: true, scores: scored.scores };
}

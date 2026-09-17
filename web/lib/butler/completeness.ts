import type { SupabaseClient } from "@supabase/supabase-js";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";

export type CompletenessIssue = {
  code: string;
  message: string;
  matchId?: string;
  boardNumber?: number;
  room?: string;
};

export type CompletenessReport = {
  expected: number;
  received: number;
  valid: number;
  special: number;
  invalid: number;
  missing: CompletenessIssue[];
  blocking: CompletenessIssue[];
  readyToPublish: boolean;
};

/**
 * Expected results = sum(board_count) over matches × 2 rooms,
 * but only for boards that exist in honor_boards for the round.
 * Typically 4 matches × 2 tables × 16 boards = 128.
 */
export async function assessHonorRoundCompleteness(
  service: SupabaseClient,
  params: {
    groupId: string;
    tournamentRound: number;
    matches: HonorRoundMatchSeating[];
  },
): Promise<CompletenessReport> {
  const { data: boards } = await service
    .from("honor_boards")
    .select("id, board_number")
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound)
    .order("board_number");

  const boardList = boards ?? [];
  const { data: results } = await service
    .from("honor_board_results")
    .select("id, match_id, room, board_id, validation_status, special_result_kind")
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound);

  const resultList = results ?? [];
  const byKey = new Set(
    resultList.map((r) => `${r.match_id}:${r.room}:${r.board_id}`),
  );

  const missing: CompletenessIssue[] = [];
  let expected = 0;

  for (const match of params.matches) {
    for (const room of ["open", "closed"] as const) {
      for (const board of boardList) {
        expected++;
        const key = `${match.match_id}:${room}:${board.id}`;
        if (!byKey.has(key)) {
          missing.push({
            code: "MISSING",
            message: `Ontbrekend: ${match.home_team.name} vs ${match.away_team.name}, ${room}, bord ${board.board_number}`,
            matchId: match.match_id,
            boardNumber: board.board_number,
            room,
          });
        }
      }
    }
  }

  const valid = resultList.filter((r) => r.validation_status === "valid").length;
  const special = resultList.filter((r) => r.validation_status === "special").length;
  const invalid = resultList.filter((r) => r.validation_status === "invalid").length;

  const blocking: CompletenessIssue[] = [...missing];
  for (const r of resultList) {
    if (r.validation_status === "invalid" || r.validation_status === "special") {
      blocking.push({
        code: r.validation_status.toUpperCase(),
        message: `Resultaat ${r.id} status ${r.validation_status}`,
        matchId: r.match_id,
        room: r.room,
      });
    }
  }

  return {
    expected,
    received: resultList.length,
    valid,
    special,
    invalid,
    missing,
    blocking,
    readyToPublish: blocking.length === 0 && expected > 0 && resultList.length >= expected,
  };
}

export async function publishHonorRound(
  service: SupabaseClient,
  params: {
    groupId: string;
    tournamentRound: number;
    matches: HonorRoundMatchSeating[];
    publishedBy?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string; completeness: CompletenessReport }> {
  const completeness = await assessHonorRoundCompleteness(service, params);
  if (!completeness.readyToPublish) {
    return {
      ok: false,
      error: "Ronde is niet compleet — publiceren geblokkeerd.",
      completeness,
    };
  }

  const now = new Date().toISOString();

  await service
    .from("honor_boards")
    .update({ publication_status: "published", updated_at: now })
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound);

  await service
    .from("honor_board_results")
    .update({ processing_status: "published", updated_at: now })
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound);

  const { data: existing } = await service
    .from("honor_round_publication")
    .select("id")
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound)
    .maybeSingle();

  if (existing?.id) {
    await service
      .from("honor_round_publication")
      .update({
        status: "published",
        published_at: now,
        published_by: params.publishedBy ?? null,
        updated_at: now,
      })
      .eq("id", existing.id);
  } else {
    await service.from("honor_round_publication").insert({
      group_id: params.groupId,
      tournament_round: params.tournamentRound,
      status: "published",
      published_at: now,
      published_by: params.publishedBy ?? null,
    });
  }

  return { ok: true };
}

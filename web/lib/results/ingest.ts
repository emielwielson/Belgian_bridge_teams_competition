import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vulnerability } from "@/lib/boards/types";
import { buildCombinationUpsert } from "@/lib/butler/combinations";
import type { HonorMappedTable } from "@/lib/bridgemate/honor-import-mapping";
import { validateNormalizedResult } from "@/lib/results/validation";
import type { NormalizedBoardResultInput } from "@/lib/results/types";

export type IngestBatchResult = {
  created: number;
  failed: number;
  results: Array<{
    index: number;
    ok: boolean;
    id?: string;
    errors?: string[];
  }>;
};

function specialToDb(kind: string | null | undefined): string {
  switch (kind) {
    case "NOT_PLAYED":
      return "not_played";
    case "ARBITRAL":
      return "arbitral";
    case "ADJUSTED":
      return "adjusted";
    case "ERASED":
      return "erased";
    default:
      return "none";
  }
}

function validationToDb(
  status: "VALID" | "INVALID" | "SPECIAL" | "PENDING",
): string {
  return status.toLowerCase();
}

async function ensureCombination(
  service: SupabaseClient,
  groupId: string,
  teamId: string,
  playerIds: [string, string],
  names: [string, string],
): Promise<string | null> {
  const row = buildCombinationUpsert({
    groupId,
    teamId,
    player1Id: playerIds[0],
    player2Id: playerIds[1],
    player1Name: names[0],
    player2Name: names[1],
  });

  const { data: existing } = await service
    .from("honor_player_combinations")
    .select("id")
    .eq("group_id", groupId)
    .eq("player_low_id", row.player_low_id)
    .eq("player_high_id", row.player_high_id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await service
    .from("honor_player_combinations")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id;
}

function parseRoom(tableId: string): "open" | "closed" | null {
  if (tableId.endsWith(":open")) return "open";
  if (tableId.endsWith(":closed")) return "closed";
  return null;
}

export async function ingestHonorBoardResults(params: {
  service: SupabaseClient;
  groupId: string;
  tournamentRound: number;
  rows: NormalizedBoardResultInput[];
  tablesById: Map<string, HonorMappedTable>;
  boardsById: Map<
    string,
    { id: string; tournament_round: number; vulnerability: string | null }
  >;
  replace?: boolean;
}): Promise<IngestBatchResult> {
  const out: IngestBatchResult = { created: 0, failed: 0, results: [] };

  if (params.replace) {
    await params.service
      .from("honor_board_results")
      .delete()
      .eq("group_id", params.groupId)
      .eq("tournament_round", params.tournamentRound);
  }

  for (let index = 0; index < params.rows.length; index++) {
    const row = params.rows[index]!;
    try {
      const table = params.tablesById.get(row.tableId);
      const board = params.boardsById.get(row.boardId);
      const room = parseRoom(row.tableId);

      if (!table || !board || !room) {
        out.failed++;
        out.results.push({
          index,
          ok: false,
          errors: ["Wedstrijd, tafel of bord niet gevonden."],
        });
        continue;
      }

      if (board.tournament_round !== params.tournamentRound) {
        out.failed++;
        out.results.push({
          index,
          ok: false,
          errors: ["Bord hoort niet bij deze ronde."],
        });
        continue;
      }

      const { data: existing } = await params.service
        .from("honor_board_results")
        .select("id")
        .eq("match_id", row.matchId)
        .eq("room", room)
        .eq("board_id", row.boardId)
        .maybeSingle();

      const validated = validateNormalizedResult(
        row,
        {
          matchId: row.matchId,
          tableId: row.tableId,
          tableMatchId: table.matchId,
          boardId: board.id,
          boardTournamentRound: board.tournament_round,
          matchTournamentRound: params.tournamentRound,
          boardVulnerability: (board.vulnerability as Vulnerability) ?? null,
          existingResultForTableBoard: !!existing && !params.replace,
          tableNsPairId: table.nsPairId,
          tableEwPairId: table.ewPairId,
        },
        {
          defaultExcludeSpecialFromDatum: true,
          requireAdminResolutionForPercentageArbitral: true,
        },
      );

      if (existing && !params.replace) {
        out.failed++;
        out.results.push({
          index,
          ok: false,
          errors: validated.issues.map((i) => i.message).length
            ? validated.issues.map((i) => i.message)
            : ["Er bestaat al een resultaat voor deze tafel en dit bord."],
        });
        continue;
      }

      const hardAssoc = validated.issues.some(
        (i) => i.code.startsWith("ASSOC_") || i.code === "DUPLICATE",
      );
      if (hardAssoc) {
        out.failed++;
        out.results.push({
          index,
          ok: false,
          errors: validated.issues.map((i) => i.message),
        });
        continue;
      }

      let nsComboId: string | null = null;
      let ewComboId: string | null = null;
      if (table.nsPlayerIds && table.nsNames && table.nsTeamId) {
        nsComboId = await ensureCombination(
          params.service,
          params.groupId,
          table.nsTeamId,
          table.nsPlayerIds,
          table.nsNames,
        );
      }
      if (table.ewPlayerIds && table.ewNames && table.ewTeamId) {
        ewComboId = await ensureCombination(
          params.service,
          params.groupId,
          table.ewTeamId,
          table.ewPlayerIds,
          table.ewNames,
        );
      }

      const adj = row.resolvedAdjustment ?? null;
      const insertRow = {
        group_id: params.groupId,
        match_id: row.matchId,
        room,
        board_id: row.boardId,
        tournament_round: params.tournamentRound,
        ns_combination_id: nsComboId,
        ew_combination_id: ewComboId,
        contract_level: row.contractLevel ?? null,
        contract_denomination: row.contractDenomination ?? null,
        doubling: row.doubling ?? "NONE",
        declarer: row.declarer ?? null,
        tricks_result: row.tricksResult ?? null,
        tricks_taken: row.tricksTaken ?? null,
        lead_card: row.leadCard ?? null,
        bridgemate_score: row.bridgemateScore ?? null,
        computed_score: validated.computedScore,
        ns_score: validated.nsScore,
        import_source: "bridgemate_bws",
        processing_status:
          validated.validationStatus === "VALID" ? "validated" : "imported",
        validation_status: validationToDb(validated.validationStatus),
        correction_status: adj ? "corrected" : "original",
        special_result_kind: specialToDb(
          adj?.specialResultKind ?? validated.specialResultKind,
        ),
        included_in_datum: adj
          ? adj.includedInDatum
          : validated.includedInDatum,
        included_in_match_score: adj ? adj.includedInMatchScore : true,
        datum_eligible: adj ? adj.datumEligible : null,
        admin_adjusted_ns_score: adj?.adminAdjustedNsScore ?? null,
        admin_adjusted_ew_score: adj?.adminAdjustedEwScore ?? null,
        admin_ns_butler_imps: adj?.adminNsButlerImps ?? null,
        admin_ew_butler_imps: adj?.adminEwButlerImps ?? null,
        adjustment_mode: adj?.adjustmentMode ?? null,
        adjustment_meta: adj?.adjustmentMeta ?? null,
        original_payload: row.originalPayload,
        validation_errors: validated.issues.map((i) => i.message),
        imported_at: new Date().toISOString(),
        ...(adj
          ? {
              corrected_at: new Date().toISOString(),
            }
          : {}),
      };

      const { data: created, error } = await params.service
        .from("honor_board_results")
        .insert(insertRow)
        .select("id")
        .single();

      if (error || !created) {
        out.failed++;
        out.results.push({
          index,
          ok: false,
          errors: [error?.message ?? "Insert mislukt."],
        });
        continue;
      }

      out.created++;
      out.results.push({ index, ok: true, id: created.id });
    } catch (e) {
      out.failed++;
      out.results.push({
        index,
        ok: false,
        errors: [e instanceof Error ? e.message : "Onbekende fout."],
      });
    }
  }

  return out;
}

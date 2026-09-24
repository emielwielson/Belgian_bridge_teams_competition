import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePbn } from "@/lib/boards/pbn-parser";
import { validateBoards } from "@/lib/boards/board-validator";

export type ImportPbnResult =
  | { ok: true; boardCount: number; boardIds: string[]; removedStale: number }
  | { ok: false; errors: string[] };

/**
 * All-or-nothing PBN import for an Honor tournament round.
 * Upserts boards from the file, then removes any other board numbers
 * left for that round (so a wrong prior upload e.g. 17–32 does not stick).
 */
export async function importPbnForHonorRound(
  service: SupabaseClient,
  params: {
    groupId: string;
    tournamentRound: number;
    pbnText: string;
  },
): Promise<ImportPbnResult> {
  const parsed = parsePbn(params.pbnText);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const validationErrors = validateBoards(parsed.boards);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      errors: validationErrors.map((e) => e.message),
    };
  }

  const boardIds: string[] = [];
  const importedNumbers = new Set(parsed.boards.map((b) => b.boardNumber));

  for (const board of parsed.boards) {
    const { data: existing } = await service
      .from("honor_boards")
      .select("id")
      .eq("group_id", params.groupId)
      .eq("tournament_round", params.tournamentRound)
      .eq("board_number", board.boardNumber)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await service
        .from("honor_boards")
        .update({
          dealer: board.dealer,
          vulnerability: board.vulnerability,
          hands: board.hands,
          publication_status: "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error || !data) {
        return {
          ok: false,
          errors: [error?.message ?? `Bord ${board.boardNumber} bijwerken mislukt.`],
        };
      }
      boardIds.push(data.id);
    } else {
      const { data, error } = await service
        .from("honor_boards")
        .insert({
          group_id: params.groupId,
          tournament_round: params.tournamentRound,
          board_number: board.boardNumber,
          dealer: board.dealer,
          vulnerability: board.vulnerability,
          hands: board.hands,
          publication_status: "draft",
        })
        .select("id")
        .single();
      if (error || !data) {
        return {
          ok: false,
          errors: [error?.message ?? `Bord ${board.boardNumber} aanmaken mislukt.`],
        };
      }
      boardIds.push(data.id);
    }
  }

  const { data: existingForRound, error: listError } = await service
    .from("honor_boards")
    .select("id, board_number")
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound);

  if (listError) {
    return {
      ok: false,
      errors: [listError.message ?? "Kon bestaande borden niet ophalen."],
    };
  }

  const staleIds = (existingForRound ?? [])
    .filter((row) => !importedNumbers.has(row.board_number as number))
    .map((row) => row.id as string);

  let removedStale = 0;
  if (staleIds.length) {
    // Cascades to honor_board_results via FK on board_id.
    const { error: deleteError } = await service
      .from("honor_boards")
      .delete()
      .in("id", staleIds);
    if (deleteError) {
      return {
        ok: false,
        errors: [
          deleteError.message ??
            "Kon verouderde borden (niet in dit PBN) niet verwijderen.",
        ],
      };
    }
    removedStale = staleIds.length;
  }

  await service.from("honor_raw_imports").insert({
    group_id: params.groupId,
    tournament_round: params.tournamentRound,
    source: "pbn",
    status: "completed",
    payload: { boardCount: boardIds.length, removedStale },
  });

  return { ok: true, boardCount: boardIds.length, boardIds, removedStale };
}

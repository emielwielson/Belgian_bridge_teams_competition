import type { SupabaseClient } from "@supabase/supabase-js";
import { adaptReceivedDataToNormalized } from "@/lib/bridgemate/adapter";
import {
  buildHonorMappingContext,
  toBridgemateSessionBoards,
} from "@/lib/bridgemate/honor-import-mapping";
import { parseBwsBuffer } from "@/lib/bridgemate/parse-bws";
import { parseReceivedDataJson } from "@/lib/bridgemate/parse-received";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";
import { recalculateHonorButler } from "@/lib/butler/recalculate";
import { ingestHonorBoardResults } from "@/lib/results/ingest";

export type ImportBwsResult =
  | {
      ok: true;
      rawImportId: string;
      mappedCount: number;
      failedMappingCount: number;
      created: number;
      failedIngest: number;
      mappingErrors: string[];
      butlerUpdated: number;
    }
  | { ok: false; error: string; mappingErrors?: string[] };

export async function importHonorBwsForRound(params: {
  service: SupabaseClient;
  groupId: string;
  tournamentRound: number;
  matches: HonorRoundMatchSeating[];
  buffer?: Buffer | null;
  receivedData?: unknown;
  filename?: string | null;
  uploadedBy?: string | null;
  replace?: boolean;
}): Promise<ImportBwsResult> {
  const { data: boards, error: boardsErr } = await params.service
    .from("honor_boards")
    .select("id, board_number, tournament_round, vulnerability")
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound);

  if (boardsErr) {
    return { ok: false, error: boardsErr.message };
  }

  const mapping = buildHonorMappingContext(
    params.tournamentRound,
    params.matches,
    toBridgemateSessionBoards(
      (boards ?? []).map((b) => ({ id: b.id, boardNumber: b.board_number })),
    ),
  );
  if (!mapping.ok) {
    return { ok: false, error: mapping.errors[0] ?? "Mapping mislukt.", mappingErrors: mapping.errors };
  }

  let rows;
  try {
    if (params.receivedData != null) {
      rows = parseReceivedDataJson(params.receivedData);
    } else if (params.buffer && params.buffer.length > 0) {
      rows = await parseBwsBuffer(params.buffer);
    } else {
      return { ok: false, error: "Geen .bws-bestand of ReceivedData aangeleverd." };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Kon Bridgemate-bestand niet lezen.",
    };
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "Het .bws-bestand bevat geen resultaten (ReceivedData is leeg). Upload niet het lege sessieplan — gebruik het bestand ná Bridgemate/BCS.",
    };
  }

  const { data: rawImport, error: rawErr } = await params.service
    .from("honor_raw_imports")
    .insert({
      group_id: params.groupId,
      tournament_round: params.tournamentRound,
      source: "bridgemate-bws",
      filename: params.filename ?? null,
      status: "processing",
      uploaded_by: params.uploadedBy ?? null,
      payload: { rowCount: rows.length },
    })
    .select("id")
    .single();

  if (rawErr || !rawImport) {
    return { ok: false, error: rawErr?.message ?? "Raw import opslaan mislukt." };
  }

  const adapted = adaptReceivedDataToNormalized(rows, mapping.ctx);
  const mappingErrors = adapted.outcomes
    .filter((o): o is Extract<typeof o, { ok: false }> => !o.ok)
    .flatMap((o) => o.errors);

  if (adapted.mappedCount === 0) {
    await params.service
      .from("honor_raw_imports")
      .update({
        status: "failed",
        errors: { mappingErrors: mappingErrors.slice(0, 40) },
        updated_at: new Date().toISOString(),
      })
      .eq("id", rawImport.id);
    return {
      ok: false,
      error:
        mappingErrors[0] ??
        "Geen Bridgemate-rijen konden worden gekoppeld aan tafels/borden.",
      mappingErrors: mappingErrors.slice(0, 40),
    };
  }

  const tablesById = new Map(
    mapping.ctx.tables.map((t) => [t.id, t] as const),
  );
  const boardsById = new Map(
    (boards ?? []).map((b) => [
      b.id,
      {
        id: b.id,
        tournament_round: b.tournament_round as number,
        vulnerability: b.vulnerability as string | null,
      },
    ]),
  );

  const ingest = await ingestHonorBoardResults({
    service: params.service,
    groupId: params.groupId,
    tournamentRound: params.tournamentRound,
    rows: adapted.rows,
    tablesById,
    boardsById,
    replace: params.replace ?? true,
  });

  const butler = await recalculateHonorButler(params.service, {
    groupId: params.groupId,
    tournamentRound: params.tournamentRound,
  });

  await params.service
    .from("honor_raw_imports")
    .update({
      status: ingest.failed > 0 && ingest.created === 0 ? "failed" : "completed",
      errors: {
        mappingErrors,
        ingestFailed: ingest.failed,
        butlerError: butler.ok ? null : butler.error,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", rawImport.id);

  if (!butler.ok) {
    return { ok: false, error: butler.error, mappingErrors };
  }

  return {
    ok: true,
    rawImportId: rawImport.id,
    mappedCount: adapted.mappedCount,
    failedMappingCount: adapted.failedCount,
    created: ingest.created,
    failedIngest: ingest.failed,
    mappingErrors,
    butlerUpdated: butler.updatedCount,
  };
}

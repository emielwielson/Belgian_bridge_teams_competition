import { NextResponse } from "next/server";
import { assertArbiterHonorApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import {
  defaultHonorRound,
  loadHonorRoundMeta,
  loadHonorRoundSeating,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError } from "@/lib/http/api-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ round: string }> },
) {
  try {
    const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    await assertArbiterHonorApiAccess(supabase, user.id, roles);
    const service = createServiceClient();
    const group = await resolveActiveHonorGroup(service);
    if (!group) {
      return jsonError("Honor division group not found for the active season", 404);
    }

    const { round: roundSeg } = await context.params;
    const meta = await loadHonorRoundMeta(service, group.id);
    const requested = Number(roundSeg);
    const round =
      Number.isInteger(requested) &&
      requested >= 1 &&
      requested <= group.round_count
        ? requested
        : defaultHonorRound(meta);

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") ?? "all";

    const seating = await loadHonorRoundSeating(service, group, round);
    const matchNameById = new Map(
      seating.matches.map((m) => [
        m.match_id,
        `${m.home_team.name} vs ${m.away_team.name}`,
      ]),
    );
    const tableByMatchRoom = new Map<string, number>();
    const playersByMatchRoom = new Map<
      string,
      { direction: string; name: string }[]
    >();
    const directionOrder = ["N", "E", "S", "W"] as const;
    for (const m of seating.matches) {
      if (m.venue_tables) {
        tableByMatchRoom.set(
          `${m.match_id}:open`,
          m.venue_tables.openTable,
        );
        tableByMatchRoom.set(
          `${m.match_id}:closed`,
          m.venue_tables.closedTable,
        );
      }
      for (const room of ["open", "closed"] as const) {
        const seats = m.seats
          .filter((s) => s.room === room)
          .map((s) => ({ direction: s.direction, name: s.name }))
          .sort(
            (a, b) =>
              directionOrder.indexOf(a.direction as (typeof directionOrder)[number]) -
              directionOrder.indexOf(b.direction as (typeof directionOrder)[number]),
          );
        playersByMatchRoom.set(`${m.match_id}:${room}`, seats);
      }
    }

    let query = service
      .from("honor_board_results")
      .select(
        `
        id,
        match_id,
        room,
        board_id,
        tournament_round,
        contract_level,
        contract_denomination,
        doubling,
        declarer,
        tricks_result,
        tricks_taken,
        ns_score,
        computed_score,
        bridgemate_score,
        ns_butler_imps,
        ew_butler_imps,
        validation_status,
        special_result_kind,
        correction_status,
        included_in_datum,
        included_in_match_score,
        datum_eligible,
        admin_adjusted_ns_score,
        admin_adjusted_ew_score,
        admin_ns_butler_imps,
        admin_ew_butler_imps,
        adjustment_mode,
        adjustment_meta,
        honor_boards ( board_number )
      `,
      )
      .eq("group_id", group.id)
      .eq("tournament_round", round)
      .order("match_id")
      .order("room");

    if (filter === "special") {
      query = query.eq("validation_status", "special");
    } else if (filter === "invalid") {
      query = query.eq("validation_status", "invalid");
    } else if (filter === "needs_attention") {
      query = query.in("validation_status", ["special", "invalid"]);
    }

    const { data, error } = await query;
    if (error) {
      return jsonError(error.message, 500);
    }

    const results = (data ?? []).map((row) => {
      const boards = row.honor_boards as
        | { board_number: number }
        | { board_number: number }[]
        | null;
      const boardNumber = Array.isArray(boards)
        ? boards[0]?.board_number ?? null
        : boards?.board_number ?? null;
      return {
        id: row.id,
        match_id: row.match_id,
        match_label: matchNameById.get(row.match_id as string) ?? row.match_id,
        room: row.room,
        table_number:
          tableByMatchRoom.get(`${row.match_id}:${row.room}`) ?? null,
        players:
          playersByMatchRoom.get(`${row.match_id}:${row.room}`) ?? [],
        board_id: row.board_id,
        board_number: boardNumber,
        tournament_round: row.tournament_round,
        contract_level: row.contract_level,
        contract_denomination: row.contract_denomination,
        doubling: row.doubling,
        declarer: row.declarer,
        tricks_result: row.tricks_result,
        tricks_taken: row.tricks_taken,
        ns_score: row.ns_score,
        computed_score: row.computed_score,
        bridgemate_score: row.bridgemate_score,
        ns_butler_imps: row.ns_butler_imps,
        ew_butler_imps: row.ew_butler_imps,
        validation_status: row.validation_status,
        special_result_kind: row.special_result_kind,
        correction_status: row.correction_status,
        included_in_datum: row.included_in_datum,
        included_in_match_score: row.included_in_match_score,
        datum_eligible: row.datum_eligible,
        admin_adjusted_ns_score: row.admin_adjusted_ns_score,
        admin_adjusted_ew_score: row.admin_adjusted_ew_score,
        admin_ns_butler_imps: row.admin_ns_butler_imps,
        admin_ew_butler_imps: row.admin_ew_butler_imps,
        adjustment_mode: row.adjustment_mode,
        adjustment_meta: row.adjustment_meta,
      };
    });

    results.sort((a, b) => {
      const tn = (a.table_number ?? 99) - (b.table_number ?? 99);
      if (tn !== 0) return tn;
      const bn = (a.board_number ?? 0) - (b.board_number ?? 0);
      if (bn !== 0) return bn;
      if (a.match_label !== b.match_label) {
        return a.match_label.localeCompare(b.match_label);
      }
      return String(a.room).localeCompare(String(b.room));
    });

    return NextResponse.json({ round, filter, results });
  } catch (err) {
    return jsonFromError(err);
  }
}

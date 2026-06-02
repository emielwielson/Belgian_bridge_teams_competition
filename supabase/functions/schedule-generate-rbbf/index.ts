import { createClient } from "@supabase/supabase-js";
import { getRbbfRoundPairingsForCount } from "./template.ts";
import { buildRoundRobinSchedule } from "./round-robin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { groupId, boardCount = 24 } = await req.json();
    if (!groupId) {
      return new Response(JSON.stringify({ error: "groupId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { error: validateError } = await supabase.rpc(
      "validate_group_schedule_generation",
      { p_group_id: groupId },
    );
    if (validateError) {
      return new Response(JSON.stringify({ error: validateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: groupRow, error: groupError } = await supabase
      .from("groups")
      .select(
        `
        id,
        round_count,
        round_robin_count,
        division:divisions (
          league:leagues (season_id, scope, region_id)
        )
      `,
      )
      .eq("id", groupId)
      .single();

    if (groupError) {
      return new Response(JSON.stringify({ error: groupError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id")
      .eq("group_id", groupId)
      .order("created_at");

    if (teamsError || !teams || teams.length < 2) {
      return new Response(
        JSON.stringify({ error: "Group must have at least 2 teams" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const teamIds = teams.map((t) => t.id as string);
    const teamCount = teamIds.length;
    const roundCount = (groupRow.round_count as number) ?? 14;
    const roundRobinCount = (groupRow.round_robin_count as number) ?? 2;

    const division = Array.isArray(groupRow.division)
      ? groupRow.division[0]
      : groupRow.division;
    const leagueRow = division?.league;
    const league = (Array.isArray(leagueRow) ? leagueRow[0] : leagueRow) as
      | {
          season_id: string;
          scope: string;
          region_id: string | null;
        }
      | undefined;

    if (!league) {
      return new Response(JSON.stringify({ error: "Group league not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: datesDivisionId, error: resolveDatesError } =
      await supabase.rpc("resolve_group_match_dates_division_id", {
        p_group_id: groupId,
      });
    if (resolveDatesError) {
      return new Response(JSON.stringify({ error: resolveDatesError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let datesQuery = supabase
      .from("competition_match_dates")
      .select("round, datetime")
      .eq("season_id", league.season_id)
      .eq("scope", league.scope)
      .order("round");

    datesQuery =
      league.scope === "national"
        ? datesQuery.is("region_id", null)
        : datesQuery.eq("region_id", league.region_id!);

    datesQuery =
      datesDivisionId == null
        ? datesQuery.is("division_id", null)
        : datesQuery.eq("division_id", datesDivisionId);

    const { data: dates, error: datesError } = await datesQuery;
    if (datesError || !dates || dates.length < roundCount) {
      return new Response(
        JSON.stringify({
          error: `Missing competition match dates (need ${roundCount})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const dateByRound = new Map(
      dates.map((d) => [d.round as number, d.datetime as string]),
    );

    const matchRows: Record<string, unknown>[] = [];
    const byeRows: { group_id: string; round: number; team_id: string; vp: number }[] =
      [];

    const useRbbf =
      league.scope === "national" ||
      (league.scope === "regional" && teamCount === 8);

    if (useRbbf) {
      if (teamCount !== 8) {
        return new Response(
          JSON.stringify({ error: "RBBF schedule requires exactly 8 teams" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const slotToTeamId = new Map(teamIds.map((id, i) => [i + 1, id]));
      const allRounds = getRbbfRoundPairingsForCount(roundCount);

      allRounds.forEach((pairings, index) => {
        const round = index + 1;
        const datetime = dateByRound.get(round);
        if (!datetime) return;

        for (const p of pairings) {
          const homeTeamId = slotToTeamId.get(p.home)!;
          matchRows.push({
            group_id: groupId,
            round,
            datetime,
            home_team_id: homeTeamId,
            away_team_id: slotToTeamId.get(p.away),
            hosting_team_id: homeTeamId,
            board_count: boardCount,
          });
        }
      });
    } else {
      const plans = buildRoundRobinSchedule(teamIds, roundRobinCount);
      for (const plan of plans) {
        const datetime = dateByRound.get(plan.round);
        if (!datetime) continue;

        for (const p of plan.pairings) {
          matchRows.push({
            group_id: groupId,
            round: plan.round,
            datetime,
            home_team_id: p.homeTeamId,
            away_team_id: p.awayTeamId,
            hosting_team_id: p.homeTeamId,
            board_count: boardCount,
          });
        }
        if (plan.byeTeamId) {
          byeRows.push({
            group_id: groupId,
            round: plan.round,
            team_id: plan.byeTeamId,
            vp: 12,
          });
        }
      }
    }

    const { error: insertError } = await supabase
      .from("matches")
      .insert(matchRows);

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (byeRows.length > 0) {
      const { error: byeError } = await supabase
        .from("group_bye_rounds")
        .insert(byeRows);
      if (byeError) {
        return new Response(JSON.stringify({ error: byeError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        matchesCreated: matchRows.length,
        rounds: roundCount,
        byesCreated: byeRows.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

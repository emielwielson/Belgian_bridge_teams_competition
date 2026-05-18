import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRbbfRoundPairings } from "./template.ts";

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

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id")
      .eq("group_id", groupId)
      .order("created_at");

    if (teamsError || !teams || teams.length !== 8) {
      return new Response(
        JSON.stringify({ error: "Group must have exactly 8 teams" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: groupRow, error: groupError } = await supabase
      .from("groups")
      .select(
        `
        id,
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

    const league = (groupRow.division as {
      league: {
        season_id: string;
        scope: string;
        region_id: string | null;
      };
    }).league;

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
    if (datesError || !dates || dates.length < 14) {
      return new Response(
        JSON.stringify({ error: "Missing competition match dates for scope" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const slotToTeamId = new Map(
      teams.map((t, i) => [i + 1, t.id as string]),
    );
    const dateByRound = new Map(
      dates.map((d) => [d.round as number, d.datetime as string]),
    );

    const matchRows: Record<string, unknown>[] = [];
    const allRounds = getRbbfRoundPairings();

    allRounds.forEach((pairings, index) => {
      const round = index + 1;
      const datetime = dateByRound.get(round);
      if (!datetime) return;

      for (const p of pairings) {
        matchRows.push({
          group_id: groupId,
          round,
          datetime,
          home_team_id: slotToTeamId.get(p.home),
          away_team_id: slotToTeamId.get(p.away),
          board_count: boardCount,
        });
      }
    });

    const { error: insertError } = await supabase
      .from("matches")
      .insert(matchRows);

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        matchesCreated: matchRows.length,
        rounds: 14,
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

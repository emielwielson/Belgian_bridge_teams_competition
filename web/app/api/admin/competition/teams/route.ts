import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { requireActiveSeason } from "@/lib/competition/season";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const groupId = new URL(request.url).searchParams.get("groupId");
    if (!groupId) return jsonError("groupId required", 400);

    const { data: teams, error } = await supabase
      .from("teams")
      .select(
        "id, name, club_id, captain_id, location, club:clubs(id, name, region_id)",
      )
      .eq("group_id", groupId)
      .order("name");

    if (error) return jsonError(error.message, 500);

    const teamIds = teams?.map((t) => t.id) ?? [];
    let rosters: Record<string, { player_id: string; player: { name: string } }[]> =
      {};

    if (teamIds.length > 0) {
      const season = await requireActiveSeason(supabase);
      const { data: players } = await supabase
        .from("team_players")
        .select("team_id, player_id, player:players(id, name)")
        .in("team_id", teamIds)
        .eq("season_id", season.id);

      for (const row of players ?? []) {
        const list = rosters[row.team_id] ?? [];
        const raw = row.player as unknown;
        const player = Array.isArray(raw)
          ? (raw[0] as { name: string } | undefined)
          : (raw as { name: string } | null);
        list.push({
          player_id: row.player_id,
          player: player ? { name: player.name } : { name: "Unknown" },
        });
        rosters[row.team_id] = list;
      }
    }

    return jsonOk({
      teams: (teams ?? []).map((t) => ({
        ...t,
        roster: rosters[t.id] ?? [],
      })),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    if (body.action === "roster_add") {
      const season = await requireActiveSeason(supabase);
      const { error } = await supabase.from("team_players").insert({
        team_id: body.team_id,
        player_id: body.player_id,
        season_id: season.id,
      });
      if (error) return jsonError(error.message, 400);
      return jsonOk({ added: true }, { status: 201 });
    }

    if (body.action === "roster_remove") {
      const season = await requireActiveSeason(supabase);
      const { error } = await supabase
        .from("team_players")
        .delete()
        .eq("team_id", body.team_id)
        .eq("player_id", body.player_id)
        .eq("season_id", season.id);
      if (error) return jsonError(error.message, 400);
      return jsonOk({ removed: true });
    }

    const { data, error } = await supabase
      .from("teams")
      .insert({
        group_id: body.group_id,
        club_id: body.club_id,
        name: body.name,
        captain_id: body.captain_id ?? null,
        location: body.location ?? null,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    return jsonOk({ team: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.captain_id !== undefined) patch.captain_id = body.captain_id;
    if (body.location !== undefined) patch.location = body.location;

    const { error } = await supabase
      .from("teams")
      .update(patch)
      .eq("id", body.id);

    if (error) return jsonError(error.message, 400);
    return jsonOk({ updated: true });
  } catch (err) {
    return jsonFromError(err);
  }
}

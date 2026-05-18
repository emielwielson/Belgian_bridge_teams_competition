import { requireAuth } from "@/lib/auth/route-auth";
import { assertClubManagerForClub } from "@/lib/auth/user-access";
import { requireActiveSeason } from "@/lib/competition/season";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ clubId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);
    const season = await requireActiveSeason(supabase);

    const { data: memberships, error } = await supabase
      .from("player_club_memberships")
      .select("id, player_id, player:players(id, name, member_number, email)")
      .eq("club_id", clubId)
      .eq("season_id", season.id);

    if (error) return jsonError(error.message, 500);
    return jsonOk({ memberships: memberships ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);
    const season = await requireActiveSeason(supabase);
    const body = await request.json();

    let playerId = body.player_id as string | undefined;

    if (!playerId) {
      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          name: body.name,
          member_number: body.member_number ?? null,
          email: body.email ?? null,
        })
        .select("id")
        .single();
      if (playerError) return jsonError(playerError.message, 400);
      playerId = player.id;
    }

    const { data, error } = await supabase
      .from("player_club_memberships")
      .insert({
        player_id: playerId,
        club_id: clubId,
        season_id: season.id,
      })
      .select("id, player_id")
      .single();

    if (error) return jsonError(error.message, 400);
    return jsonOk({ membership: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);

    const body = await request.json();
    const { error } = await supabase
      .from("player_club_memberships")
      .delete()
      .eq("id", body.membership_id)
      .eq("club_id", clubId);

    if (error) return jsonError(error.message, 400);
    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonFromError(err);
  }
}

import {
  COMPETITION_ADMIN_ROLES,
  requireAuth,
} from "@/lib/auth/route-auth";
import { assertClubManagerForClub } from "@/lib/auth/user-access";
import { hasAnyRole } from "@/lib/auth/roles";
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

    const playerId = body.player_id as string | undefined;
    if (!playerId) {
      const isAdmin = hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES]);
      if (!isAdmin) {
        return jsonError(
          "player_id is required; club managers cannot create new players",
          403,
        );
      }
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
      const newPlayerId = player.id;

      const { data, error } = await supabase
        .from("player_club_memberships")
        .insert({
          player_id: newPlayerId,
          club_id: clubId,
          season_id: season.id,
        })
        .select("id, player_id")
        .single();

      if (error) return jsonError(error.message, 400);
      return jsonOk({ membership: data }, { status: 201 });
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

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);

    const body = await request.json();
    const playerId = body.player_id as string | undefined;
    if (!playerId) {
      return jsonError("player_id is required", 400);
    }

    const season = await requireActiveSeason(supabase);
    const { data: membership, error: membershipError } = await supabase
      .from("player_club_memberships")
      .select("id")
      .eq("club_id", clubId)
      .eq("player_id", playerId)
      .eq("season_id", season.id)
      .maybeSingle();

    if (membershipError) return jsonError(membershipError.message, 500);
    if (!membership) {
      return jsonError("Player is not a member of this club", 403);
    }

    const authUserId =
      body.auth_user_id === null || body.auth_user_id === ""
        ? null
        : (body.auth_user_id as string);

    const { data, error } = await supabase
      .from("players")
      .update({ auth_user_id: authUserId })
      .eq("id", playerId)
      .select("id, name, auth_user_id")
      .single();

    if (error) return jsonError(error.message, 400);
    return jsonOk({ player: data });
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

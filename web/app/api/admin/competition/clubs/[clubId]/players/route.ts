import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { requireActiveSeason } from "@/lib/competition/season";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ clubId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);

    const { data: memberships, error } = await supabase
      .from("player_club_memberships")
      .select("player_id, player:players(id, name, member_number)")
      .eq("club_id", clubId)
      .eq("season_id", season.id);

    if (error) return jsonError(error.message, 500);

    const players = (memberships ?? [])
      .map((row) => {
        const raw = row.player as unknown;
        const player = Array.isArray(raw)
          ? (raw[0] as { id: string; name: string; member_number: string | null } | undefined)
          : (raw as { id: string; name: string; member_number: string | null } | null);
        if (!player?.id) return null;
        return {
          id: player.id,
          name: player.name,
          member_number: player.member_number,
        };
      })
      .filter((p): p is { id: string; name: string; member_number: string | null } => p != null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return jsonOk({ players });
  } catch (err) {
    return jsonFromError(err);
  }
}

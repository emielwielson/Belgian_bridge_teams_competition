import {
  assertManagesClub,
  assertManagesScopeRegion,
  COMPETITION_KIND_CODES,
  type CompetitionKindCode,
} from "@/lib/auth/competition-scope";
import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { loadEligibleClubMembers } from "@/lib/competition/active-primary-membership";
import { REGION_CODES, SCOPES } from "@/lib/competition/scopes";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ clubId: string }> };

function parseKindParam(raw: string | null): CompetitionKindCode | null {
  if (
    raw === COMPETITION_KIND_CODES.NATIONAL ||
    raw === COMPETITION_KIND_CODES.FLANDERS ||
    raw === COMPETITION_KIND_CODES.WALLONIA ||
    raw === COMPETITION_KIND_CODES.ZWEIFFEL
  ) {
    return raw;
  }
  return null;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);

    const kind = parseKindParam(
      new URL(request.url).searchParams.get("kind"),
    );

    // Zweiffel teams use Flanders/Wallonia clubs; authorize via competition unit,
    // not club-region ownership (which maps only to flanders/wallonia kinds).
    if (kind === COMPETITION_KIND_CODES.ZWEIFFEL) {
      await assertManagesScopeRegion(
        supabase,
        user.id,
        roles,
        SCOPES.REGIONAL,
        REGION_CODES.ZWEIFFEL,
      );
    } else {
      await assertManagesClub(supabase, clubId);
    }

    const memberships = await loadEligibleClubMembers<{
      player: unknown;
    }>(
      supabase,
      clubId,
      "player_id, player:players(id, name, member_number)",
      kind,
    );

    const players = memberships
      .map((row) => {
        const raw = row.player;
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

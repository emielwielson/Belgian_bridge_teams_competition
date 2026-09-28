import {
  COMPETITION_KIND_CODES,
  getManagedCompetitionKinds,
  regionCodeForKind,
  type CompetitionKindCode,
} from "@/lib/auth/competition-scope";
import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { REGION_CODES } from "@/lib/competition/scopes";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

function kindFromRegionCode(code: string | undefined): CompetitionKindCode | null {
  if (code === REGION_CODES.WALLONIA) return COMPETITION_KIND_CODES.WALLONIA;
  if (code === REGION_CODES.FLANDERS) return COMPETITION_KIND_CODES.FLANDERS;
  if (code === REGION_CODES.ZWEIFFEL) return COMPETITION_KIND_CODES.ZWEIFFEL;
  return null;
}

/** Club geography for listing: Zweiffel uses Flanders+Wallonia clubs. */
function clubRegionCodesForKind(kind: CompetitionKindCode): string[] {
  if (kind === COMPETITION_KIND_CODES.ZWEIFFEL) {
    return [REGION_CODES.FLANDERS, REGION_CODES.WALLONIA];
  }
  const code = regionCodeForKind(kind);
  return code ? [code] : [];
}

export async function GET(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const regionId = new URL(request.url).searchParams.get("regionId");
    const managed = await getManagedCompetitionKinds(supabase, user.id, roles);

    let query = supabase
      .from("clubs")
      .select(
        "id, name, address, postal_code, location, competition_location, region_id, region:regions(code, name)",
      )
      .is("deleted_at", null)
      .order("name");

    if (regionId) {
      const { data: region } = await supabase
        .from("regions")
        .select("code")
        .eq("id", regionId)
        .maybeSingle();
      const kind = kindFromRegionCode(region?.code);
      if (
        !kind ||
        (!managed.isGlobal && !managed.kindCodes.includes(kind))
      ) {
        return jsonOk({ clubs: [] });
      }

      const clubRegionCodes = clubRegionCodesForKind(kind);
      if (kind === COMPETITION_KIND_CODES.ZWEIFFEL) {
        const { data: regions } = await supabase
          .from("regions")
          .select("id")
          .in("code", clubRegionCodes);
        const ids = (regions ?? []).map((r) => r.id);
        if (ids.length === 0) return jsonOk({ clubs: [] });
        query = query.in("region_id", ids);
      } else {
        query = query.eq("region_id", regionId);
      }
    } else if (!managed.isGlobal) {
      const clubRegionCodes = [
        ...new Set(
          managed.kindCodes.flatMap((k) => clubRegionCodesForKind(k)),
        ),
      ];
      if (clubRegionCodes.length === 0) {
        return jsonOk({ clubs: [] });
      }
      const { data: regions } = await supabase
        .from("regions")
        .select("id")
        .in("code", clubRegionCodes);
      const ids = (regions ?? []).map((r) => r.id);
      if (ids.length === 0) return jsonOk({ clubs: [] });
      query = query.in("region_id", ids);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    return jsonOk({ clubs: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const body = await request.json();

    const { data: region } = await supabase
      .from("regions")
      .select("id, code")
      .eq("id", body.region_id)
      .maybeSingle();
    if (!region) return jsonError("Invalid region", 400);

    if (region.code === REGION_CODES.ZWEIFFEL) {
      return jsonError(
        "Clubs cannot be created in the Zweiffel region; use Flanders or Wallonia",
        400,
      );
    }

    const managed = await getManagedCompetitionKinds(supabase, user.id, roles);
    const kind = kindFromRegionCode(region.code);
    if (
      !kind ||
      (!managed.isGlobal && !managed.kindCodes.includes(kind))
    ) {
      return jsonError("Forbidden: cannot manage this club", 403);
    }

    const { data, error } = await supabase
      .from("clubs")
      .insert({ name: body.name, region_id: body.region_id })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    return jsonOk({ club: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REGION_CODES,
  SCOPES,
  type CompetitionScope,
  type RegionCode,
} from "@/lib/competition/scopes";
import type { CompetitionUnit } from "@/lib/competition/scope-setup";
import { AuthError } from "./auth-error";
import { ROLES } from "./roles";

export const COMPETITION_KIND_CODES = {
  NATIONAL: "national",
  FLANDERS: "flanders",
  WALLONIA: "wallonia",
} as const;

export type CompetitionKindCode =
  (typeof COMPETITION_KIND_CODES)[keyof typeof COMPETITION_KIND_CODES];

export type ManagedCompetitionKinds =
  | { isGlobal: true; kindIds: string[]; kindCodes: CompetitionKindCode[] }
  | { isGlobal: false; kindIds: string[]; kindCodes: CompetitionKindCode[] };

export function kindCodeForUnit(unit: CompetitionUnit): CompetitionKindCode {
  if (unit.scope === SCOPES.NATIONAL) return COMPETITION_KIND_CODES.NATIONAL;
  return unit.regionCode === REGION_CODES.WALLONIA
    ? COMPETITION_KIND_CODES.WALLONIA
    : COMPETITION_KIND_CODES.FLANDERS;
}

export function kindCodeForScopeRegion(
  scope: CompetitionScope,
  regionCode?: string | null,
): CompetitionKindCode | null {
  if (scope === SCOPES.NATIONAL) return COMPETITION_KIND_CODES.NATIONAL;
  if (regionCode === REGION_CODES.FLANDERS) {
    return COMPETITION_KIND_CODES.FLANDERS;
  }
  if (regionCode === REGION_CODES.WALLONIA) {
    return COMPETITION_KIND_CODES.WALLONIA;
  }
  return null;
}

export async function resolveCompetitionKindId(
  supabase: SupabaseClient,
  code: CompetitionKindCode,
): Promise<string> {
  const { data, error } = await supabase
    .from("competition_kinds")
    .select("id")
    .eq("code", code)
    .single();
  if (error || !data) {
    throw new Error(`Competition kind not found: ${code}`);
  }
  return data.id;
}

/**
 * Managed kinds for a competition manager.
 * system_admin and unscoped competition_manager → global (all kinds).
 * competition_manager with scope rows → only those kinds.
 */
export async function getManagedCompetitionKinds(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
): Promise<ManagedCompetitionKinds> {
  const { data: allKinds, error: kindsError } = await supabase
    .from("competition_kinds")
    .select("id, code")
    .order("code");
  if (kindsError) throw kindsError;

  const kindCodes = (allKinds ?? []).map(
    (k) => k.code as CompetitionKindCode,
  );
  const kindIds = (allKinds ?? []).map((k) => k.id);

  if (roles.includes(ROLES.SYSTEM_ADMIN)) {
    return { isGlobal: true, kindIds, kindCodes };
  }

  if (!roles.includes(ROLES.COMPETITION_MANAGER)) {
    return { isGlobal: false, kindIds: [], kindCodes: [] };
  }

  const { data: scopes, error: scopesError } = await supabase
    .from("competition_manager_scopes")
    .select("competition_kind_id")
    .eq("user_id", userId);
  if (scopesError) throw scopesError;

  if (!scopes || scopes.length === 0) {
    return { isGlobal: true, kindIds, kindCodes };
  }

  const scopedIds = new Set(scopes.map((s) => s.competition_kind_id));
  const managed = (allKinds ?? []).filter((k) => scopedIds.has(k.id));
  return {
    isGlobal: false,
    kindIds: managed.map((k) => k.id),
    kindCodes: managed.map((k) => k.code as CompetitionKindCode),
  };
}

export function managesKindCode(
  managed: ManagedCompetitionKinds,
  code: CompetitionKindCode,
): boolean {
  if (managed.isGlobal) return true;
  return managed.kindCodes.includes(code);
}

export async function assertManagesCompetitionUnit(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  unit: CompetitionUnit,
): Promise<void> {
  const managed = await getManagedCompetitionKinds(supabase, userId, roles);
  const code = kindCodeForUnit(unit);
  if (!managesKindCode(managed, code)) {
    throw new AuthError("Forbidden: cannot manage this competition", 403);
  }
}

export async function assertManagesScopeRegion(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  scope: CompetitionScope,
  regionCode?: string | null,
): Promise<void> {
  const code = kindCodeForScopeRegion(scope, regionCode);
  if (!code) {
    throw new AuthError("Forbidden: cannot manage this competition", 403);
  }
  const managed = await getManagedCompetitionKinds(supabase, userId, roles);
  if (!managesKindCode(managed, code)) {
    throw new AuthError("Forbidden: cannot manage this competition", 403);
  }
}

export async function assertManagesLeague(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("current_user_manages_league", {
    p_league_id: leagueId,
  });
  if (error) throw error;
  if (!data) {
    throw new AuthError("Forbidden: cannot manage this competition", 403);
  }
}

export async function assertManagesGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("current_user_manages_group", {
    p_group_id: groupId,
  });
  if (error) throw error;
  if (!data) {
    throw new AuthError("Forbidden: cannot manage this competition", 403);
  }
}

export async function assertManagesMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("current_user_manages_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
  if (!data) {
    throw new AuthError("Forbidden: cannot manage this competition", 403);
  }
}

export async function assertManagesClub(
  supabase: SupabaseClient,
  clubId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("current_user_manages_club", {
    p_club_id: clubId,
  });
  if (error) throw error;
  if (!data) {
    throw new AuthError("Forbidden: cannot manage this club", 403);
  }
}

export async function assertManagesTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("current_user_manages_team", {
    p_team_id: teamId,
  });
  if (error) throw error;
  if (!data) {
    throw new AuthError("Forbidden: cannot manage this team", 403);
  }
}

export async function userManagesMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("current_user_manages_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function userManagesTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("current_user_manages_team", {
    p_team_id: teamId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function filterMatchIdsByManagedKinds(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  matchIds: string[],
): Promise<string[]> {
  if (matchIds.length === 0) return [];
  const managed = await getManagedCompetitionKinds(supabase, userId, roles);
  if (managed.isGlobal) return matchIds;
  if (managed.kindIds.length === 0) return [];

  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, groups!inner(divisions!inner(leagues!inner(competition_kind_id)))",
    )
    .in("id", matchIds);
  if (error) throw error;

  const kindSet = new Set(managed.kindIds);
  return (data ?? [])
    .filter((row) => {
      const groups = row.groups as unknown;
      const group = Array.isArray(groups) ? groups[0] : groups;
      if (!group || typeof group !== "object") return false;
      const divisions = (group as { divisions?: unknown }).divisions;
      const division = Array.isArray(divisions) ? divisions[0] : divisions;
      if (!division || typeof division !== "object") return false;
      const leagues = (division as { leagues?: unknown }).leagues;
      const league = Array.isArray(leagues) ? leagues[0] : leagues;
      if (!league || typeof league !== "object") return false;
      const kindId = (league as { competition_kind_id?: string })
        .competition_kind_id;
      return kindId != null && kindSet.has(kindId);
    })
    .map((row) => row.id as string);
}

export async function filterLeagueRowsByManagedKinds<
  T extends { competition_kind_id?: string | null; scope: string; region_id?: string | null },
>(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  leagues: T[],
): Promise<T[]> {
  const managed = await getManagedCompetitionKinds(supabase, userId, roles);
  if (managed.isGlobal) return leagues;
  if (managed.kindIds.length === 0) return [];

  const kindSet = new Set(managed.kindIds);
  const withKind = leagues.filter(
    (l) => l.competition_kind_id && kindSet.has(l.competition_kind_id),
  );
  if (withKind.length > 0 || leagues.every((l) => l.competition_kind_id)) {
    return withKind;
  }

  // Fallback when competition_kind_id not selected: map scope/region → kind code
  const { data: regions } = await supabase.from("regions").select("id, code");
  const regionCodeById = new Map(
    (regions ?? []).map((r) => [r.id, r.code as RegionCode]),
  );
  return leagues.filter((l) => {
    const code =
      l.scope === SCOPES.NATIONAL
        ? COMPETITION_KIND_CODES.NATIONAL
        : l.region_id
          ? regionCodeById.get(l.region_id) === REGION_CODES.WALLONIA
            ? COMPETITION_KIND_CODES.WALLONIA
            : COMPETITION_KIND_CODES.FLANDERS
          : null;
    return code != null && managesKindCode(managed, code);
  });
}

export function regionCodeForKind(
  code: CompetitionKindCode,
): RegionCode | null {
  if (code === COMPETITION_KIND_CODES.FLANDERS) return REGION_CODES.FLANDERS;
  if (code === COMPETITION_KIND_CODES.WALLONIA) return REGION_CODES.WALLONIA;
  return null;
}

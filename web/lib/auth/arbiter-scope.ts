import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPETITION_KIND_CODES,
  getManagedCompetitionKinds,
  managesKindCode,
  type CompetitionKindCode,
  type ManagedCompetitionKinds,
} from "@/lib/auth/competition-scope";
import { AuthError } from "@/lib/auth/auth-error";
import { ROLES } from "@/lib/auth/roles";

export type ArbiterAccess = {
  kinds: CompetitionKindCode[];
  kindIds: string[];
  honor: boolean;
  inbox: boolean;
};

export type ArbiterNavAccess = {
  kinds: CompetitionKindCode[];
  showHonor: boolean;
  href: string | null;
};

/** Display order for inbox tabs: National → Flanders → Wallonia. */
export const ARBITER_INBOX_KIND_ORDER: CompetitionKindCode[] = [
  COMPETITION_KIND_CODES.NATIONAL,
  COMPETITION_KIND_CODES.FLANDERS,
  COMPETITION_KIND_CODES.WALLONIA,
];

export function isCompetitionKindCode(
  value: string,
): value is CompetitionKindCode {
  return (ARBITER_INBOX_KIND_ORDER as string[]).includes(value);
}

export function orderArbiterInboxKinds(
  kinds: CompetitionKindCode[],
): CompetitionKindCode[] {
  return ARBITER_INBOX_KIND_ORDER.filter((k) => kinds.includes(k));
}

export function arbiterKindHref(kind: CompetitionKindCode): string {
  return `/arbiter/${kind}`;
}

export function hasArbiterInboxAccess(access: ArbiterAccess): boolean {
  return access.inbox;
}

export function hasArbiterHonorAccess(access: ArbiterAccess): boolean {
  return access.honor;
}

export function arbiterCanAccessMatchKind(
  access: ArbiterAccess,
  kind: CompetitionKindCode | null | undefined,
): boolean {
  if (!kind) return false;
  return access.kinds.includes(kind);
}

export async function getArbiterAccess(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
): Promise<ArbiterAccess> {
  if (!roles.includes(ROLES.ARBITER)) {
    return { kinds: [], kindIds: [], honor: false, inbox: false };
  }

  const [{ data: kinds }, { data: scopes }, { data: honorRow }] =
    await Promise.all([
      supabase.from("competition_kinds").select("id, code").order("code"),
      supabase
        .from("arbiter_competition_scopes")
        .select("competition_kind_id")
        .eq("user_id", userId),
      supabase
        .from("arbiter_honor_access")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const kindById = new Map(
    (kinds ?? []).map((k) => [k.id, k.code as CompetitionKindCode]),
  );
  const kindIds = (scopes ?? [])
    .map((s) => s.competition_kind_id)
    .filter((id): id is string => Boolean(id));
  const kindCodes = kindIds
    .map((id) => kindById.get(id))
    .filter((c): c is CompetitionKindCode => Boolean(c));

  return {
    kinds: orderArbiterInboxKinds(kindCodes),
    kindIds,
    honor: honorRow != null,
    inbox: kindCodes.length > 0,
  };
}

/**
 * Effective arbiter UI surfaces for header/nav.
 * Pass managedKinds for system_admin / competition_manager (from getManagedCompetitionKinds).
 */
export function resolveArbiterNavAccess(options: {
  roles: string[];
  arbiterAccess: ArbiterAccess | null | undefined;
  managedKinds?: CompetitionKindCode[] | null;
}): ArbiterNavAccess {
  const { roles, arbiterAccess, managedKinds } = options;

  if (roles.includes(ROLES.SYSTEM_ADMIN)) {
    const kinds = orderArbiterInboxKinds(
      managedKinds?.length ? managedKinds : ARBITER_INBOX_KIND_ORDER,
    );
    return {
      kinds,
      showHonor: true,
      href: kinds[0] ? arbiterKindHref(kinds[0]) : "/arbiter/honor",
    };
  }

  if (roles.includes(ROLES.COMPETITION_MANAGER)) {
    const kinds = orderArbiterInboxKinds(
      managedKinds?.length ? managedKinds : ARBITER_INBOX_KIND_ORDER,
    );
    return {
      kinds,
      showHonor: true,
      href: kinds[0] ? arbiterKindHref(kinds[0]) : "/arbiter/honor",
    };
  }

  if (!roles.includes(ROLES.ARBITER) || !arbiterAccess) {
    return { kinds: [], showHonor: false, href: null };
  }

  const kinds = orderArbiterInboxKinds(arbiterAccess.kinds);
  const showHonor = hasArbiterHonorAccess(arbiterAccess);
  const href = kinds[0]
    ? arbiterKindHref(kinds[0])
    : showHonor
      ? "/arbiter/honor"
      : null;
  return { kinds, showHonor, href };
}

/** Load nav access including managed kinds for managers/admins. */
export async function loadArbiterNavAccess(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
): Promise<ArbiterNavAccess> {
  const arbiterAccess = await getArbiterAccess(supabase, userId, roles);
  let managedKinds: CompetitionKindCode[] | undefined;
  if (
    roles.includes(ROLES.SYSTEM_ADMIN) ||
    roles.includes(ROLES.COMPETITION_MANAGER)
  ) {
    const managed = await getManagedCompetitionKinds(supabase, userId, roles);
    managedKinds = orderArbiterInboxKinds(managed.kindCodes);
  }
  return resolveArbiterNavAccess({ roles, arbiterAccess, managedKinds });
}

export function managerCanGrantHonor(managed: ManagedCompetitionKinds): boolean {
  return managesKindCode(managed, COMPETITION_KIND_CODES.NATIONAL);
}

export function filterKindCodesToManaged(
  managed: ManagedCompetitionKinds,
  kinds: CompetitionKindCode[],
): CompetitionKindCode[] {
  return kinds.filter((k) => managesKindCode(managed, k));
}

/**
 * Pure arbiters need honor access; competition managers keep access unchanged.
 */
export async function assertArbiterHonorApiAccess(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
): Promise<void> {
  if (
    roles.includes(ROLES.COMPETITION_MANAGER) ||
    roles.includes(ROLES.SYSTEM_ADMIN)
  ) {
    return;
  }
  const access = await getArbiterAccess(supabase, userId, roles);
  if (!hasArbiterHonorAccess(access)) {
    throw new AuthError("Forbidden: Honor Division access required", 403);
  }
}

/**
 * Pure arbiters need at least one competition-kind scope for the inbox.
 */
export async function assertArbiterInboxApiAccess(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
): Promise<void> {
  if (
    roles.includes(ROLES.COMPETITION_MANAGER) ||
    roles.includes(ROLES.SYSTEM_ADMIN)
  ) {
    return;
  }
  const access = await getArbiterAccess(supabase, userId, roles);
  if (!hasArbiterInboxAccess(access)) {
    throw new AuthError("Forbidden: arbiter inbox access required", 403);
  }
}

/** Assert the caller may open a specific competition-kind inbox. */
export async function assertArbiterKindAccess(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  kind: CompetitionKindCode,
): Promise<void> {
  if (roles.includes(ROLES.SYSTEM_ADMIN)) return;

  if (roles.includes(ROLES.COMPETITION_MANAGER)) {
    const managed = await getManagedCompetitionKinds(supabase, userId, roles);
    if (!managesKindCode(managed, kind)) {
      throw new AuthError("Forbidden: cannot access this competition inbox", 403);
    }
    return;
  }

  const access = await getArbiterAccess(supabase, userId, roles);
  if (!arbiterCanAccessMatchKind(access, kind)) {
    throw new AuthError("Forbidden: cannot access this competition inbox", 403);
  }
}

/**
 * Resolve group ids belonging to a competition kind (league → division → group).
 */
export async function groupIdsForCompetitionKind(
  supabase: SupabaseClient,
  kind: CompetitionKindCode,
): Promise<string[]> {
  const { data: kindRow, error: kindError } = await supabase
    .from("competition_kinds")
    .select("id")
    .eq("code", kind)
    .maybeSingle();
  if (kindError) throw kindError;
  if (!kindRow) return [];

  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("id")
    .eq("competition_kind_id", kindRow.id);
  if (leaguesError) throw leaguesError;
  const leagueIds = (leagues ?? []).map((l) => l.id);
  if (leagueIds.length === 0) return [];

  const { data: divisions, error: divisionsError } = await supabase
    .from("divisions")
    .select("id")
    .in("league_id", leagueIds);
  if (divisionsError) throw divisionsError;
  const divisionIds = (divisions ?? []).map((d) => d.id);
  if (divisionIds.length === 0) return [];

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id")
    .in("division_id", divisionIds);
  if (groupsError) throw groupsError;
  return (groups ?? []).map((g) => g.id);
}

export async function userIsArbiterForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "current_user_is_arbiter_for_match",
    { p_match_id: matchId },
  );
  if (error) throw error;
  return Boolean(data);
}

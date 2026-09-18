import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPETITION_KIND_CODES,
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
    kinds: kindCodes,
    kindIds,
    honor: honorRow != null,
    inbox: kindCodes.length > 0,
  };
}

/** Effective arbiter UI surfaces for header/nav (managers keep both). */
export function resolveArbiterNavAccess(options: {
  roles: string[];
  arbiterAccess: ArbiterAccess | null | undefined;
}): { showInbox: boolean; showHonor: boolean; href: string | null } {
  const { roles, arbiterAccess } = options;
  if (roles.includes(ROLES.SYSTEM_ADMIN)) {
    return { showInbox: true, showHonor: true, href: "/arbiter" };
  }
  if (roles.includes(ROLES.COMPETITION_MANAGER)) {
    return { showInbox: true, showHonor: true, href: "/arbiter" };
  }
  if (!roles.includes(ROLES.ARBITER) || !arbiterAccess) {
    return { showInbox: false, showHonor: false, href: null };
  }
  const showInbox = hasArbiterInboxAccess(arbiterAccess);
  const showHonor = hasArbiterHonorAccess(arbiterAccess);
  const href = showInbox ? "/arbiter" : showHonor ? "/arbiter/honor" : null;
  return { showInbox, showHonor, href };
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

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActorDisplayName } from "@/lib/auth/actor-display-name";
import { AuthError } from "@/lib/auth/auth-error";
import {
  COMPETITION_ADMIN_ROLES,
  ROLES,
  hasAnyRole,
} from "@/lib/auth/roles";

export type HonorArbiterOption = {
  userId: string;
  label: string;
};

/** Competition managers / system admins may attribute a ruling to a Honor arbiter. */
export function canChooseRulingArbiter(roles: string[]): boolean {
  return hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES]);
}

export async function listHonorArbitersForAttribution(
  service: SupabaseClient,
): Promise<HonorArbiterOption[]> {
  const { data: honorRows, error: honorError } = await service
    .from("arbiter_honor_access")
    .select("user_id");
  if (honorError) throw honorError;

  const honorIds = [...new Set((honorRows ?? []).map((r) => r.user_id))];
  if (honorIds.length === 0) return [];

  const { data: roleRows, error: roleError } = await service
    .from("user_roles")
    .select("user_id")
    .eq("role", ROLES.ARBITER)
    .in("user_id", honorIds);
  if (roleError) throw roleError;

  const options: HonorArbiterOption[] = [];
  for (const row of roleRows ?? []) {
    const label = await resolveActorDisplayName(service, row.user_id);
    options.push({
      userId: row.user_id,
      label: label ?? row.user_id,
    });
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

export async function assertHonorArbiterUser(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  const [{ data: honorRow, error: honorError }, { data: roleRow, error: roleError }] =
    await Promise.all([
      service
        .from("arbiter_honor_access")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle(),
      service
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", ROLES.ARBITER)
        .maybeSingle(),
    ]);
  if (honorError) throw honorError;
  if (roleError) throw roleError;
  if (!honorRow || !roleRow) {
    throw new AuthError("Forbidden: selected user is not a Honor arbiter", 403);
  }
}

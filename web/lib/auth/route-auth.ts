import { createSessionClient } from "@/lib/supabase/server-client";
import { hasAnyRole } from "./roles";
import { getUserRoles } from "./session";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth() {
  const supabase = await createSessionClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError("Unauthorized", 401);
  }

  const roles = await getUserRoles(supabase, user.id);
  return { user, roles, supabase };
}

export const COMPETITION_ADMIN_ROLES = [
  "system_admin",
  "competition_manager",
] as const;

export async function requireRoles(required: string[]) {
  const ctx = await requireAuth();
  if (!hasAnyRole(ctx.roles, required)) {
    throw new AuthError("Forbidden", 403);
  }
  return ctx;
}

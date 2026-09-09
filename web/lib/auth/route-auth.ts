import { createSessionClient } from "@/lib/supabase/server-client";
import { AuthError } from "./auth-error";
import { hasAnyRole } from "./roles";
import { getUserRoles } from "./session";

export { AuthError } from "./auth-error";
export { COMPETITION_ADMIN_ROLES } from "./roles";

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

export async function requireRoles(required: string[]) {
  const ctx = await requireAuth();
  if (!hasAnyRole(ctx.roles, required)) {
    throw new AuthError("Forbidden", 403);
  }
  return ctx;
}

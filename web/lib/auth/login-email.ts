import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidLoginEmailFormat(email: string): boolean {
  return EMAIL_FORMAT.test(normalizeLoginEmail(email));
}

async function isEmailOnPlayerRecord(
  supabase: SupabaseClient,
  normalizedEmail: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("players")
    .select("email")
    .not("email", "is", null)
    .ilike("email", normalizedEmail)
    .limit(10);

  if (error) {
    throw error;
  }

  return (data ?? []).some(
    (row) =>
      row.email != null &&
      normalizeLoginEmail(row.email) === normalizedEmail,
  );
}

async function emailHasAssignedRole(
  supabase: SupabaseClient,
  normalizedEmail: string,
): Promise<boolean> {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw error;
    }

    const users = data.users;
    const matchedUser = users.find(
      (user) =>
        user.email != null &&
        normalizeLoginEmail(user.email) === normalizedEmail,
    );

    if (matchedUser) {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", matchedUser.id)
        .limit(1);

      if (rolesError) {
        throw rolesError;
      }

      return (roles?.length ?? 0) > 0;
    }

    if (users.length < perPage) {
      return false;
    }

    page += 1;
  }
}

export async function isEmailAllowedForLogin(
  supabase: SupabaseClient,
  normalizedEmail: string,
): Promise<boolean> {
  if (await isEmailOnPlayerRecord(supabase, normalizedEmail)) {
    return true;
  }

  return emailHasAssignedRole(supabase, normalizedEmail);
}

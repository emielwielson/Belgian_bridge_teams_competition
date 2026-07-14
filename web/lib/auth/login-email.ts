import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidLoginEmailFormat(email: string): boolean {
  return EMAIL_FORMAT.test(normalizeLoginEmail(email));
}

export function isSignupNotAllowedAuthError(error: {
  message?: string;
  code?: string;
}): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "otp_disabled" ||
    message.includes("signups not allowed")
  );
}

export function isEmailNotRegisteredError(error: string | undefined): boolean {
  if (!error) {
    return false;
  }
  return (
    error === "auth.emailNotRegistered" || isSignupNotAllowedAuthError({ message: error })
  );
}

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  normalizedEmail: string,
) {
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

    const matchedUser = data.users.find(
      (user) =>
        user.email != null &&
        normalizeLoginEmail(user.email) === normalizedEmail,
    );
    if (matchedUser) {
      return matchedUser;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
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
  const matchedUser = await findAuthUserByEmail(supabase, normalizedEmail);
  if (!matchedUser) {
    return false;
  }

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

export async function isEmailAllowedForLogin(
  supabase: SupabaseClient,
  normalizedEmail: string,
): Promise<boolean> {
  if (await isEmailOnPlayerRecord(supabase, normalizedEmail)) {
    return true;
  }

  return emailHasAssignedRole(supabase, normalizedEmail);
}

/** Create auth.users row for allowed first-time logins when sign-ups are disabled globally. */
export async function ensureAuthUserForLogin(
  supabase: SupabaseClient,
  normalizedEmail: string,
): Promise<void> {
  const existingUser = await findAuthUserByEmail(supabase, normalizedEmail);
  if (existingUser) {
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }
}

export type LoginOtpError = Pick<AuthError, "message" | "code" | "status">;

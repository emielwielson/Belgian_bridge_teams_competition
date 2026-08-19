import { NextResponse } from "next/server";
import {
  AUTH_NEXT_COOKIE,
  authNextCookieOptions,
  safeNextPath,
} from "@/lib/auth/auth-next";
import {
  ensureAuthUserForLogin,
  isEmailAllowedForLogin,
  isSignupNotAllowedAuthError,
  isValidLoginEmailFormat,
  normalizeLoginEmail,
} from "@/lib/auth/login-email";
import { jsonErrorCode, jsonOk } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

type LoginBody = {
  email?: string;
  next?: string;
};

function appBaseUrl(fallbackOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!configured) return fallbackOrigin;
  return configured.startsWith("http") ? configured : `https://${configured}`;
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
  }

  const rawEmail = body.email?.trim() ?? "";
  if (!rawEmail || !isValidLoginEmailFormat(rawEmail)) {
    return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
  }

  const normalizedEmail = normalizeLoginEmail(rawEmail);
  const supabase = createServiceClient();

  let allowed: boolean;
  try {
    allowed = await isEmailAllowedForLogin(supabase, normalizedEmail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!allowed) {
    return jsonErrorCode(ErrorCodes.auth.emailNotRegistered, 404);
  }

  // Emails must link to the configured domain regardless of which host the user
  // started the login from, so link URLs stay aligned with the sending domain.
  const baseUrl = appBaseUrl(new URL(request.url).origin);
  // Bare confirm URL — shared Magic Link template appends ?token_hash=…
  const redirectTo = new URL("/auth/confirm", baseUrl).toString();
  const next = safeNextPath(body.next?.trim() || "/");

  try {
    await ensureAuthUserForLogin(supabase, normalizedEmail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });

  if (error) {
    if (isSignupNotAllowedAuthError(error)) {
      return jsonErrorCode(ErrorCodes.auth.emailNotRegistered, 404);
    }
    const status = error.status === 429 ? 429 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  const response = jsonOk({ ok: true });
  response.cookies.set(AUTH_NEXT_COOKIE, next, authNextCookieOptions());
  return response;
}

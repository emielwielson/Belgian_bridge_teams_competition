import { NextResponse } from "next/server";
import {
  isEmailAllowedForLogin,
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

  const origin = new URL(request.url).origin;
  const next = body.next?.trim() || "/";
  const redirectTo = new URL("/auth/callback", origin);
  redirectTo.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: { emailRedirectTo: redirectTo.toString() },
  });

  if (error) {
    const status = error.status === 429 ? 429 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return jsonOk({ ok: true });
}

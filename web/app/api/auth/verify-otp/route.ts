import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  createAuthRouteSupabase,
  redirectAfterAuthSession,
  resolvePostLoginNext,
} from "@/lib/auth/complete-auth-session";
import {
  isValidLoginEmailFormat,
  normalizeLoginEmail,
} from "@/lib/auth/login-email";
import { jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type VerifyOtpBody = {
  email?: string;
  token?: string;
};

/**
 * OTP fallback when the Magic Link cannot be used (e.g. Safe Links burned the hash).
 * Hosted Auth uses an 8-digit email OTP.
 */
export async function POST(request: NextRequest) {
  let body: VerifyOtpBody;
  try {
    body = (await request.json()) as VerifyOtpBody;
  } catch {
    return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
  }

  const rawEmail = body.email?.trim() ?? "";
  const token = body.token?.trim() ?? "";

  if (!rawEmail || !isValidLoginEmailFormat(rawEmail) || !/^\d{8}$/.test(token)) {
    return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
  }

  const email = normalizeLoginEmail(rawEmail);
  const origin = new URL(request.url).origin;
  const next = resolvePostLoginNext(request);
  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createAuthRouteSupabase(request, response);

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email" as EmailOtpType,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Client expects JSON with redirect URL (fetch cannot follow cross-flow redirects well).
  const finished = await redirectAfterAuthSession(
    request,
    supabase,
    response,
    next,
  );
  const location = finished.headers.get("location") ?? `${origin}${next}`;

  const json = NextResponse.json({ ok: true, redirectTo: location });
  finished.cookies.getAll().forEach((cookie) => {
    json.cookies.set(cookie.name, cookie.value);
  });
  return json;
}

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  createAuthRouteSupabase,
  redirectAfterAuthSession,
  resolvePostLoginNext,
} from "@/lib/auth/complete-auth-session";
import { jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type ConfirmBody = {
  token_hash?: string;
  type?: string;
};

/**
 * Completes Magic Link login. Called only from the confirm page button click
 * so Outlook Safe Links prefetch (GET) cannot consume the one-time token.
 */
export async function POST(request: NextRequest) {
  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
  }

  const tokenHash = body.token_hash?.trim() ?? "";
  if (!tokenHash) {
    return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
  }

  const type = (body.type?.trim() || "email") as EmailOtpType;
  const origin = new URL(request.url).origin;
  const next = resolvePostLoginNext(request);
  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createAuthRouteSupabase(request, response);

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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

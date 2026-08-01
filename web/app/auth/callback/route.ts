import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/auth-next";
import {
  createAuthRouteSupabase,
  redirectAfterAuthSession,
  resolvePostLoginNext,
} from "@/lib/auth/complete-auth-session";

/**
 * Legacy auth completion (PKCE `code` exchange, older Magic Links).
 * Normal Magic Link login uses /auth/confirm instead (Safe Links safe).
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = resolvePostLoginNext(
    request,
    searchParams.get("next") ? safeNextPath(searchParams.get("next")) : null,
  );

  if (!token_hash && !code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createAuthRouteSupabase(request, response);

  let error: { message: string } | null = null;

  if (token_hash && type) {
    const result = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    error = result.error;
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return redirectAfterAuthSession(request, supabase, response, next);
}

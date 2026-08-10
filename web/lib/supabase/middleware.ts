import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "./env";

type UpdateSessionResult = {
  supabase: ReturnType<typeof createServerClient>;
  response: NextResponse;
  user: User | null;
};

/**
 * Refresh the Supabase auth session cookies for this request.
 * Must run on (almost) every matched request so access tokens stay valid
 * even when the user only browses public pages.
 */
export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, response, user };
}

/** Copy Set-Cookie headers from a refreshed session response onto a redirect. */
export function copyCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    to.cookies.set(name, value, options);
  });
}

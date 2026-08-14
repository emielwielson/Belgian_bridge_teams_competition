/** @vitest-environment node */
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  copyCookies,
} from "./middleware";

function setCookieHeader(response: NextResponse): string {
  return response.headers.getSetCookie?.().join("\n") ??
    response.headers.get("set-cookie") ??
    "";
}

describe("copyCookies", () => {
  it("restores Max-Age when getAll omits it so cookies are not session cookies", () => {
    const from = NextResponse.next();
    // Simulate Next.js getAll losing maxAge by setting without reading back options.
    from.cookies.set("sb-test-auth-token", "session-payload", {
      path: "/",
      sameSite: "lax",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    });

    // Build a source that only exposes name/value (what often happens after getAll).
    const stripped = NextResponse.next();
    stripped.cookies.set("sb-test-auth-token", "session-payload");

    const to = NextResponse.json({ ok: true });
    copyCookies(stripped, to);

    const header = setCookieHeader(to);
    expect(header).toMatch(/sb-test-auth-token=session-payload/i);
    expect(header).toMatch(/Max-Age=34560000/i);
  });

  it("uses Max-Age=0 for empty cookie values (deletions)", () => {
    const from = NextResponse.next();
    from.cookies.set("auth_next", "");

    const to = NextResponse.json({ ok: true });
    copyCookies(from, to);

    const header = setCookieHeader(to);
    expect(header).toMatch(/auth_next=/i);
    expect(header).toMatch(/Max-Age=0/i);
  });

  it("preserves an explicit maxAge including 0", () => {
    const from = NextResponse.next();
    from.cookies.set("sb-test-auth-token", "payload", {
      path: "/",
      maxAge: 0,
    });

    const to = NextResponse.json({ ok: true });
    copyCookies(from, to);

    const header = setCookieHeader(to);
    expect(header).toMatch(/Max-Age=0/i);
  });
});

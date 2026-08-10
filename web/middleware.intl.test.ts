/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUser(...args),
    },
    from: (...args: unknown[]) => from(...args),
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublicEnv: () => ({
    url: "http://supabase.test",
    publishableKey: "test-key",
  }),
}));

import { middleware } from "./middleware";

function requestFor(
  pathname: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers,
  });
}

beforeEach(() => {
  getUser.mockReset();
  from.mockReset();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  from.mockReturnValue({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
    }),
  });
});

describe("middleware locale cookie", () => {
  it("sets NEXT_LOCALE from Accept-Language on public paths", async () => {
    const response = await middleware(
      requestFor("/", {
        "accept-language": "nl-BE,en;q=0.9",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("nl");
  });

  it("does not overwrite an existing valid locale cookie", async () => {
    const response = await middleware(
      requestFor("/standings", {
        "accept-language": "fr-BE",
        cookie: "NEXT_LOCALE=en",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBeUndefined();
  });
});

describe("middleware session refresh", () => {
  it("calls getUser on public paths and does not redirect anonymous users", async () => {
    const response = await middleware(requestFor("/standings"));

    expect(getUser).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects anonymous users from protected paths to login", async () => {
    const response = await middleware(requestFor("/player"));

    expect(getUser).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fplayer",
    );
  });
});

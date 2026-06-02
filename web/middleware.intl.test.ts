/** @vitest-environment node */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function requestFor(
  pathname: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers,
  });
}

describe("middleware intl", () => {
  it("sets NEXT_LOCALE from Accept-Language nl on public paths", async () => {
    const response = await middleware(
      requestFor("/", {
        "accept-language": "nl",
        cookie: "NEXT_LOCALE=invalid",
      }),
    );

    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("nl");
  });

  it("returns intl response unchanged for unguarded paths", async () => {
    const response = await middleware(
      requestFor("/unknown-page", {
        "accept-language": "fr",
        cookie: "NEXT_LOCALE=invalid",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("fr");
  });
});

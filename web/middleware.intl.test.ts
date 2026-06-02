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

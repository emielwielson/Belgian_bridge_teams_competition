import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getAppBaseUrl,
  matchPostponementUrl,
} from "./postponement-email";

describe("postponement-email URLs", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, NEXT_PUBLIC_APP_URL: "https://app.example.com" };
  });

  afterEach(() => {
    process.env = env;
  });

  it("builds match URL for approve link", () => {
    expect(matchPostponementUrl("match-abc")).toBe(
      "https://app.example.com/player/matches/match-abc",
    );
  });

  it("strips trailing slash from base URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    expect(getAppBaseUrl()).toBe("https://app.example.com");
  });
});

import { describe, expect, it } from "vitest";
import { LEAGUE_NAMES } from "@/lib/competition/league-names";
import { translateLeagueName } from "@/lib/i18n/labels";

describe("translateLeagueName", () => {
  const tRegions = (key: string) => `regions:${key}`;

  it("maps canonical names to region translation keys", () => {
    expect(translateLeagueName(LEAGUE_NAMES.NATIONAL, tRegions)).toBe(
      "regions:national",
    );
    expect(translateLeagueName(LEAGUE_NAMES.FLANDERS, tRegions)).toBe(
      "regions:flanders",
    );
    expect(translateLeagueName(LEAGUE_NAMES.WALLONIA, tRegions)).toBe(
      "regions:wallonia",
    );
  });

  it("falls back to the original name for unknown leagues", () => {
    expect(translateLeagueName("Some Custom League", tRegions)).toBe(
      "Some Custom League",
    );
  });
});

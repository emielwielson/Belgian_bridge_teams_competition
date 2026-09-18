import { describe, expect, it } from "vitest";
import { parseKindCodes } from "@/lib/admin/arbiters";
import {
  filterKindCodesToManaged,
  managerCanGrantHonor,
} from "@/lib/auth/arbiter-scope";
import type { ManagedCompetitionKinds } from "@/lib/auth/competition-scope";

const flandersOnly: ManagedCompetitionKinds = {
  isGlobal: false,
  kindIds: ["k-f"],
  kindCodes: ["flanders"],
};

const nationalScoped: ManagedCompetitionKinds = {
  isGlobal: false,
  kindIds: ["k-n"],
  kindCodes: ["national"],
};

describe("manager arbiter grant rules", () => {
  it("Flanders manager cannot grant Honor", () => {
    expect(managerCanGrantHonor(flandersOnly)).toBe(false);
  });

  it("National manager can grant Honor", () => {
    expect(managerCanGrantHonor(nationalScoped)).toBe(true);
  });

  it("filters kinds to managed set", () => {
    expect(
      filterKindCodesToManaged(flandersOnly, ["national", "flanders", "wallonia"]),
    ).toEqual(["flanders"]);
  });
});

describe("parseKindCodes", () => {
  it("accepts known codes and drops junk", () => {
    expect(parseKindCodes(["flanders", "nope", "national", "flanders"])).toEqual([
      "flanders",
      "national",
    ]);
    expect(parseKindCodes(null)).toEqual([]);
  });
});

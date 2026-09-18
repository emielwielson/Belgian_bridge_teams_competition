import { describe, expect, it } from "vitest";
import {
  arbiterCanAccessMatchKind,
  arbiterKindHref,
  hasArbiterHonorAccess,
  hasArbiterInboxAccess,
  isCompetitionKindCode,
  orderArbiterInboxKinds,
  resolveArbiterNavAccess,
  type ArbiterAccess,
} from "./arbiter-scope";
import { ROLES } from "./roles";

function access(
  partial: Partial<ArbiterAccess> & Pick<ArbiterAccess, "kinds" | "honor">,
): ArbiterAccess {
  return {
    kindIds: [],
    inbox: partial.kinds.length > 0,
    ...partial,
  };
}

describe("arbiter access helpers", () => {
  it("detects inbox vs honor", () => {
    const inboxOnly = access({ kinds: ["flanders"], honor: false });
    expect(hasArbiterInboxAccess(inboxOnly)).toBe(true);
    expect(hasArbiterHonorAccess(inboxOnly)).toBe(false);

    const honorOnly = access({ kinds: [], honor: true, inbox: false });
    expect(hasArbiterInboxAccess(honorOnly)).toBe(false);
    expect(hasArbiterHonorAccess(honorOnly)).toBe(true);
  });

  it("checks match kind membership", () => {
    const a = access({ kinds: ["national", "wallonia"], honor: false });
    expect(arbiterCanAccessMatchKind(a, "national")).toBe(true);
    expect(arbiterCanAccessMatchKind(a, "flanders")).toBe(false);
    expect(arbiterCanAccessMatchKind(a, null)).toBe(false);
  });

  it("orders inbox kinds National → Flanders → Wallonia", () => {
    expect(orderArbiterInboxKinds(["wallonia", "national", "flanders"])).toEqual(
      ["national", "flanders", "wallonia"],
    );
  });

  it("validates kind codes", () => {
    expect(isCompetitionKindCode("national")).toBe(true);
    expect(isCompetitionKindCode("honor")).toBe(false);
  });
});

describe("resolveArbiterNavAccess", () => {
  it("gives admins all kind tabs and honor", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.SYSTEM_ADMIN],
        arbiterAccess: null,
      }),
    ).toEqual({
      kinds: ["national", "flanders", "wallonia"],
      showHonor: true,
      href: "/arbiter/national",
    });
  });

  it("limits managers to managed kinds", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.COMPETITION_MANAGER],
        arbiterAccess: null,
        managedKinds: ["flanders", "wallonia"],
      }),
    ).toEqual({
      kinds: ["flanders", "wallonia"],
      showHonor: true,
      href: "/arbiter/flanders",
    });
  });

  it("routes honor-only arbiters to honor", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.ARBITER],
        arbiterAccess: access({ kinds: [], honor: true, inbox: false }),
      }),
    ).toEqual({
      kinds: [],
      showHonor: true,
      href: "/arbiter/honor",
    });
  });

  it("routes multi-scope arbiters to first kind tab", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.ARBITER],
        arbiterAccess: access({
          kinds: ["wallonia", "flanders"],
          honor: true,
        }),
      }),
    ).toEqual({
      kinds: ["flanders", "wallonia"],
      showHonor: true,
      href: "/arbiter/flanders",
    });
  });

  it("routes inbox-only arbiters to their kind", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.ARBITER],
        arbiterAccess: access({ kinds: ["flanders"], honor: false }),
      }),
    ).toEqual({
      kinds: ["flanders"],
      showHonor: false,
      href: arbiterKindHref("flanders"),
    });
  });

  it("hides nav when arbiter has no scopes", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.ARBITER],
        arbiterAccess: access({ kinds: [], honor: false, inbox: false }),
      }),
    ).toEqual({ kinds: [], showHonor: false, href: null });
  });
});

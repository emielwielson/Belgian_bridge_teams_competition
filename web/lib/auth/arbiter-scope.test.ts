import { describe, expect, it } from "vitest";
import {
  arbiterCanAccessMatchKind,
  hasArbiterHonorAccess,
  hasArbiterInboxAccess,
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
});

describe("resolveArbiterNavAccess", () => {
  it("gives managers both surfaces", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.COMPETITION_MANAGER],
        arbiterAccess: null,
      }),
    ).toEqual({ showInbox: true, showHonor: true, href: "/arbiter" });
  });

  it("routes honor-only arbiters to honor", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.ARBITER],
        arbiterAccess: access({ kinds: [], honor: true, inbox: false }),
      }),
    ).toEqual({
      showInbox: false,
      showHonor: true,
      href: "/arbiter/honor",
    });
  });

  it("routes inbox-only arbiters to inbox", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.ARBITER],
        arbiterAccess: access({ kinds: ["flanders"], honor: false }),
      }),
    ).toEqual({ showInbox: true, showHonor: false, href: "/arbiter" });
  });

  it("hides nav when arbiter has no scopes", () => {
    expect(
      resolveArbiterNavAccess({
        roles: [ROLES.ARBITER],
        arbiterAccess: access({ kinds: [], honor: false, inbox: false }),
      }),
    ).toEqual({ showInbox: false, showHonor: false, href: null });
  });
});

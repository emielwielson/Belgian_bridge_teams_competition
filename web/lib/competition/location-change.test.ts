import { describe, expect, it } from "vitest";
import {
  canAccessLocationChangeWorkflow,
  hasLocationChangeRespondActions,
  isLocationChangeCaptain,
} from "./location-change";
import type { MatchLocationChangeState } from "./location-change";

function baseState(
  overrides: Partial<MatchLocationChangeState> = {},
): MatchLocationChangeState {
  return {
    match_id: "m1",
    datetime: "2025-06-01T12:00:00.000Z",
    played_at: null,
    home_team_id: "h1",
    away_team_id: "a1",
    location_override: null,
    captain_teams: ["h1"],
    can_propose: false,
    can_approve: false,
    can_reject: false,
    can_cancel: false,
    pending: null,
    ...overrides,
  };
}

describe("canAccessLocationChangeWorkflow", () => {
  it("allows captains who can propose on unscored matches", () => {
    expect(
      canAccessLocationChangeWorkflow(baseState({ can_propose: true })),
    ).toBe(true);
  });

  it("allows competition managers who can propose without captain_teams", () => {
    expect(
      canAccessLocationChangeWorkflow(
        baseState({ captain_teams: [], can_propose: true }),
      ),
    ).toBe(true);
  });

  it("allows users who may respond to a pending request", () => {
    expect(
      canAccessLocationChangeWorkflow(
        baseState({ captain_teams: [], can_approve: true, can_reject: true }),
      ),
    ).toBe(true);
  });

  it("denies regular players without propose or respond actions", () => {
    expect(canAccessLocationChangeWorkflow(baseState())).toBe(false);
  });

  it("denies played matches", () => {
    expect(
      canAccessLocationChangeWorkflow(
        baseState({
          played_at: "2025-01-01T00:00:00.000Z",
          can_propose: true,
        }),
      ),
    ).toBe(false);
  });
});

describe("isLocationChangeCaptain", () => {
  it("is true when captain_teams is non-empty", () => {
    expect(isLocationChangeCaptain(baseState())).toBe(true);
  });

  it("is false when captain_teams is empty", () => {
    expect(isLocationChangeCaptain(baseState({ captain_teams: [] }))).toBe(
      false,
    );
  });
});

describe("hasLocationChangeRespondActions", () => {
  it("is true when any respond flag is set", () => {
    expect(
      hasLocationChangeRespondActions(baseState({ can_cancel: true })),
    ).toBe(true);
  });

  it("is false when no respond flags are set", () => {
    expect(hasLocationChangeRespondActions(baseState())).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  canAccessHomeAwaySwitchWorkflow,
  hasHomeAwaySwitchRespondActions,
  isHomeAwaySwitchCaptain,
  shouldShowHomeAwaySwitchSection,
} from "./home-away-switch";
import type { MatchHomeAwaySwitchState } from "./home-away-switch";

function baseState(
  overrides: Partial<MatchHomeAwaySwitchState> = {},
): MatchHomeAwaySwitchState {
  return {
    match_id: "m1",
    round: 10,
    played_at: null,
    home_team_id: "h1",
    away_team_id: "a1",
    hosting_team_id: "h1",
    captain_teams: ["h1"],
    needs_switch: true,
    is_mirror_round: true,
    first_leg_round: 3,
    first_leg: { home_team_id: "h1", away_team_id: "a1" },
    can_propose: false,
    can_approve: false,
    can_reject: false,
    can_cancel: false,
    pending: null,
    ...overrides,
  };
}

describe("shouldShowHomeAwaySwitchSection", () => {
  it("returns true for unscored non-mirror matches too", () => {
    expect(
      shouldShowHomeAwaySwitchSection(
        baseState({ is_mirror_round: false, round: 3 }),
      ),
    ).toBe(true);
  });

  it("returns true for unscored mirror-round matches", () => {
    expect(shouldShowHomeAwaySwitchSection(baseState())).toBe(true);
  });

  it("returns false when match is played", () => {
    expect(
      shouldShowHomeAwaySwitchSection(
        baseState({ played_at: "2025-01-01T00:00:00.000Z" }),
      ),
    ).toBe(false);
  });
});

describe("canAccessHomeAwaySwitchWorkflow", () => {
  it("matches section visibility for API GET", () => {
    expect(canAccessHomeAwaySwitchWorkflow(baseState())).toBe(true);
    expect(canAccessHomeAwaySwitchWorkflow(null)).toBe(false);
  });
});

describe("isHomeAwaySwitchCaptain", () => {
  it("detects captain membership", () => {
    expect(isHomeAwaySwitchCaptain(baseState())).toBe(true);
    expect(isHomeAwaySwitchCaptain(baseState({ captain_teams: [] }))).toBe(
      false,
    );
  });
});

describe("hasHomeAwaySwitchRespondActions", () => {
  it("is true when manager or captain may approve or reject", () => {
    expect(
      hasHomeAwaySwitchRespondActions(
        baseState({ captain_teams: [], can_approve: true, can_reject: true }),
      ),
    ).toBe(true);
    expect(hasHomeAwaySwitchRespondActions(baseState())).toBe(false);
  });
});

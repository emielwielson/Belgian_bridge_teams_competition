import { describe, expect, it } from "vitest";
import { canAccessHomeAwaySwitchWorkflow } from "./home-away-switch";
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

describe("canAccessHomeAwaySwitchWorkflow", () => {
  it("returns false when not a mirror round", () => {
    expect(
      canAccessHomeAwaySwitchWorkflow(
        baseState({ is_mirror_round: false, can_propose: true }),
      ),
    ).toBe(false);
  });

  it("returns true when captain can propose", () => {
    expect(canAccessHomeAwaySwitchWorkflow(baseState({ can_propose: true }))).toBe(
      true,
    );
  });

  it("returns true for read-only when already mirrored", () => {
    expect(
      canAccessHomeAwaySwitchWorkflow(
        baseState({ needs_switch: false, captain_teams: ["h1"] }),
      ),
    ).toBe(true);
  });

  it("returns false when already mirrored and user is not a captain", () => {
    expect(
      canAccessHomeAwaySwitchWorkflow(
        baseState({ needs_switch: false, captain_teams: [] }),
      ),
    ).toBe(false);
  });
});

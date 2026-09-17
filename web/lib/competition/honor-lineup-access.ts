import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchContext } from "@/lib/auth/match-access";
import { userManagesMatch } from "@/lib/auth/competition-scope";
import { isUserOnTeam } from "@/lib/auth/match-access";
import {
  ARBITER_ACCESS_ROLES,
  COMPETITION_ADMIN_ROLES,
  hasAnyRole,
} from "@/lib/auth/roles";
import {
  canEditHonorSide,
  canLockHonorSide,
  canViewOpponentLineup,
  honorLineupPhase,
  roundsPerRoundRobin,
  venueTablesForHonorMatch,
  type HonorLineupPhase,
  type HonorSide,
  type HonorVenueTables,
} from "@/lib/competition/honor-lineup";
import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";

export type HonorMatchLineupContext = {
  isHonor: boolean;
  phase: HonorLineupPhase;
  roundsPerRr: number;
  roundCount: number;
  homeLocked: boolean;
  awayLocked: boolean;
  venueTables: HonorVenueTables | null;
};

export async function loadHonorMatchLineupContext(
  supabase: SupabaseClient,
  match: MatchContext,
): Promise<HonorMatchLineupContext> {
  const scoring = await loadGroupScoringContext(supabase, match.group_id);
  const isHonor = scoring.divisionLevelCode === "honor";

  const { data: group, error } = await supabase
    .from("groups")
    .select("round_count, round_robin_count")
    .eq("id", match.group_id)
    .maybeSingle();
  if (error) throw error;

  const roundCount = group?.round_count ?? 21;
  const roundRobinCount = group?.round_robin_count ?? 3;
  const roundsPerRr = roundsPerRoundRobin(roundCount, roundRobinCount);
  const phase = honorLineupPhase(match.round, roundsPerRr);

  let venueTables: HonorVenueTables | null = null;
  if (isHonor) {
    const { data: slots, error: slotsError } = await supabase
      .from("group_schedule_slots")
      .select("slot, team_id")
      .eq("group_id", match.group_id)
      .not("team_id", "is", null);
    if (slotsError) throw slotsError;

    const homeSlot =
      slots?.find((s) => s.team_id === match.home_team_id)?.slot ?? null;
    const awaySlot =
      slots?.find((s) => s.team_id === match.away_team_id)?.slot ?? null;
    venueTables = venueTablesForHonorMatch({
      round: match.round,
      roundCount,
      homeSlot,
      awaySlot,
    });
  }

  return {
    isHonor,
    phase,
    roundsPerRr,
    roundCount,
    homeLocked: match.home_lineup_locked_at != null,
    awayLocked: match.away_lineup_locked_at != null,
    venueTables,
  };
}

export async function resolveHonorViewerSide(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  match: MatchContext,
): Promise<HonorSide | "manager" | "other"> {
  if (hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES])) {
    if (await userManagesMatch(supabase, match.id)) return "manager";
  }
  if (await isUserOnTeam(supabase, userId, match.home_team_id)) return "home";
  if (await isUserOnTeam(supabase, userId, match.away_team_id)) return "away";
  return "other";
}

export function canViewerSeeTeamLineup(options: {
  viewerSide: HonorSide | "manager" | "other";
  teamSide: HonorSide;
  phase: HonorLineupPhase;
  homeLocked: boolean;
  awayLocked: boolean;
}): boolean {
  if (options.viewerSide === "manager") return true;
  if (options.viewerSide === options.teamSide) return true;
  if (options.viewerSide === "other") {
    return options.homeLocked && options.awayLocked;
  }
  return canViewOpponentLineup({
    viewerSide: options.viewerSide,
    phase: options.phase,
    homeLocked: options.homeLocked,
    awayLocked: options.awayLocked,
  });
}

/** Floor directors (arbiter access) and scoped competition managers may unlock. */
export function canUnlockHonorLineup(options: {
  roles: string[];
  viewerSide: HonorSide | "manager" | "other";
}): boolean {
  if (hasAnyRole(options.roles, [...ARBITER_ACCESS_ROLES])) return true;
  return options.viewerSide === "manager";
}

export function honorPermissionsForViewer(options: {
  viewerSide: HonorSide | "manager" | "other";
  phase: HonorLineupPhase;
  homeLocked: boolean;
  awayLocked: boolean;
  played: boolean;
  roles?: string[];
}) {
  const isManager = options.viewerSide === "manager";
  const canUnlock = canUnlockHonorLineup({
    roles: options.roles ?? [],
    viewerSide: options.viewerSide,
  });
  return {
    canEditHome: canEditHonorSide({
      side: "home",
      phase: options.phase,
      homeLocked: options.homeLocked,
      awayLocked: options.awayLocked,
      isManager,
      played: options.played,
    }),
    canEditAway: canEditHonorSide({
      side: "away",
      phase: options.phase,
      homeLocked: options.homeLocked,
      awayLocked: options.awayLocked,
      isManager,
      played: options.played,
    }),
    canViewHome: canViewerSeeTeamLineup({
      viewerSide: options.viewerSide,
      teamSide: "home",
      phase: options.phase,
      homeLocked: options.homeLocked,
      awayLocked: options.awayLocked,
    }),
    canViewAway: canViewerSeeTeamLineup({
      viewerSide: options.viewerSide,
      teamSide: "away",
      phase: options.phase,
      homeLocked: options.homeLocked,
      awayLocked: options.awayLocked,
    }),
    canLockHome: canLockHonorSide({
      side: "home",
      phase: options.phase,
      homeLocked: options.homeLocked,
      awayLocked: options.awayLocked,
      isManager,
      played: options.played,
      seatsComplete: true,
    }),
    canLockAway: canLockHonorSide({
      side: "away",
      phase: options.phase,
      homeLocked: options.homeLocked,
      awayLocked: options.awayLocked,
      isManager,
      played: options.played,
      seatsComplete: true,
    }),
    canUnlock,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPETITION_KIND_CODES } from "@/lib/auth/competition-scope";

/** Membership eligibility for most competitions: active primary only (no season_id). */
export const ACTIVE_PRIMARY = {
  membership_type: "primary",
  status: "active",
} as const;

export const ACTIVE_MEMBERSHIP_STATUS = "active" as const;

const PRIMARY_ONLY = ["primary"] as const;
/** Ledenbeheer enum: primary | second (not "secondary"). */
const PRIMARY_OR_SECOND = ["primary", "second"] as const;

export function allowsSecondaryMembers(
  competitionKindCode: string | null | undefined,
): boolean {
  return competitionKindCode === COMPETITION_KIND_CODES.ZWEIFFEL;
}

export function eligibleMembershipTypes(
  competitionKindCode?: string | null,
): readonly string[] {
  return allowsSecondaryMembers(competitionKindCode)
    ? PRIMARY_OR_SECOND
    : PRIMARY_ONLY;
}

function withMembershipTypeColumn(select: string): string {
  if (/(^|[, ])membership_type([, ]|$)/.test(select)) return select;
  return `${select}, membership_type`;
}

function filterRowsByMembershipType<T extends Record<string, unknown>>(
  rows: T[],
  membershipTypes: readonly string[],
): T[] {
  const allowed = new Set(membershipTypes);
  return rows.filter((row) =>
    allowed.has(String(row.membership_type ?? "")),
  );
}

/**
 * Load active club members eligible for the competition kind.
 * Filters membership_type in JS so we never pass unknown enum labels to PostgREST
 * (primary-only uses a SQL eq filter; multi-type loads all active then filters).
 */
export async function loadEligibleClubMembers<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  clubId: string,
  select: string,
  competitionKindCode?: string | null,
): Promise<T[]> {
  const membershipTypes = eligibleMembershipTypes(competitionKindCode);

  if (membershipTypes.length === 1) {
    const { data, error } = await supabase
      .from("player_club_memberships")
      .select(select)
      .eq("club_id", clubId)
      .eq("membership_type", membershipTypes[0]!)
      .eq("status", ACTIVE_MEMBERSHIP_STATUS);
    if (error) throw error;
    return (data ?? []) as T[];
  }

  const { data, error } = await supabase
    .from("player_club_memberships")
    .select(withMembershipTypeColumn(select))
    .eq("club_id", clubId)
    .eq("status", ACTIVE_MEMBERSHIP_STATUS);
  if (error) throw error;
  return filterRowsByMembershipType(
    (data ?? []) as unknown as Record<string, unknown>[],
    membershipTypes,
  ) as T[];
}

/** @deprecated Prefer loadEligibleClubMembers with competition kind when known. */
export async function loadActivePrimaryClubMembers<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  clubId: string,
  select: string,
): Promise<T[]> {
  return loadEligibleClubMembers(supabase, clubId, select, null);
}

export async function findEligibleClubMember(
  supabase: SupabaseClient,
  input: {
    clubId: string;
    playerId: string;
    competitionKindCode?: string | null;
  },
): Promise<{ id: string } | null> {
  const membershipTypes = eligibleMembershipTypes(input.competitionKindCode);

  if (membershipTypes.length === 1) {
    const { data, error } = await supabase
      .from("player_club_memberships")
      .select("id")
      .eq("club_id", input.clubId)
      .eq("player_id", input.playerId)
      .eq("membership_type", membershipTypes[0]!)
      .eq("status", ACTIVE_MEMBERSHIP_STATUS)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("player_club_memberships")
    .select("id, membership_type")
    .eq("club_id", input.clubId)
    .eq("player_id", input.playerId)
    .eq("status", ACTIVE_MEMBERSHIP_STATUS);
  if (error) throw error;
  const match = filterRowsByMembershipType(
    (data ?? []) as unknown as Record<string, unknown>[],
    membershipTypes,
  )[0];
  return match ? { id: match.id as string } : null;
}

/** @deprecated Prefer findEligibleClubMember with competition kind when known. */
export async function findActivePrimaryClubMember(
  supabase: SupabaseClient,
  input: { clubId: string; playerId: string },
): Promise<{ id: string } | null> {
  return findEligibleClubMember(supabase, input);
}

export async function loadActivePrimaryMembershipsForPlayers<
  T = Record<string, unknown>,
>(
  supabase: SupabaseClient,
  playerIds: string[],
  select: string,
): Promise<T[]> {
  if (playerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("player_club_memberships")
    .select(select)
    .in("player_id", playerIds)
    .eq("membership_type", ACTIVE_PRIMARY.membership_type)
    .eq("status", ACTIVE_PRIMARY.status);

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function loadEligiblePlayerIdsAtClub(
  supabase: SupabaseClient,
  clubId: string,
  playerIds: string[],
  competitionKindCode?: string | null,
): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();

  const membershipTypes = eligibleMembershipTypes(competitionKindCode);

  if (membershipTypes.length === 1) {
    const { data, error } = await supabase
      .from("player_club_memberships")
      .select("player_id")
      .eq("club_id", clubId)
      .in("player_id", playerIds)
      .eq("membership_type", membershipTypes[0]!)
      .eq("status", ACTIVE_MEMBERSHIP_STATUS);
    if (error) throw error;
    return new Set((data ?? []).map((row) => row.player_id as string));
  }

  const { data, error } = await supabase
    .from("player_club_memberships")
    .select("player_id, membership_type")
    .eq("club_id", clubId)
    .in("player_id", playerIds)
    .eq("status", ACTIVE_MEMBERSHIP_STATUS);
  if (error) throw error;
  return new Set(
    filterRowsByMembershipType(
      (data ?? []) as unknown as Record<string, unknown>[],
      membershipTypes,
    ).map((row) => row.player_id as string),
  );
}

/** @deprecated Prefer loadEligiblePlayerIdsAtClub with competition kind when known. */
export async function loadActivePrimaryPlayerIdsAtClub(
  supabase: SupabaseClient,
  clubId: string,
  playerIds: string[],
): Promise<Set<string>> {
  return loadEligiblePlayerIdsAtClub(supabase, clubId, playerIds, null);
}

export async function loadCompetitionKindCodeForGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("groups")
    .select(
      "division:divisions(league:leagues(competition_kind:competition_kinds(code)))",
    )
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  return unwrapCompetitionKindCode(data);
}

export async function loadCompetitionKindCodeForTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("teams")
    .select(
      "group:groups(division:divisions(league:leagues(competition_kind:competition_kinds(code))))",
    )
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw error;
  const group = unwrapOne(data?.group);
  return unwrapCompetitionKindCode(group);
}

export async function loadCompetitionKindCodeForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "group:groups(division:divisions(league:leagues(competition_kind:competition_kinds(code))))",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  const group = unwrapOne(data?.group);
  return unwrapCompetitionKindCode(group);
}

function unwrapOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function unwrapCompetitionKindCode(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const division = unwrapOne((row as { division?: unknown }).division);
  if (!division || typeof division !== "object") return null;
  const league = unwrapOne((division as { league?: unknown }).league);
  if (!league || typeof league !== "object") return null;
  const kind = unwrapOne(
    (league as { competition_kind?: unknown }).competition_kind,
  );
  if (!kind || typeof kind !== "object") return null;
  const code = (kind as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

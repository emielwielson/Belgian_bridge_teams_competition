import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPETITION_KIND_CODES } from "@/lib/auth/competition-scope";

/** Membership eligibility for most competitions: active primary only (no season_id). */
export const ACTIVE_PRIMARY = {
  membership_type: "primary",
  status: "active",
} as const;

export const ACTIVE_MEMBERSHIP_STATUS = "active" as const;

const PRIMARY_ONLY = ["primary"] as const;
/**
 * Zweiffel: primary (active), or second/federation (any status) when the player
 * also has an active primary membership somewhere (home club).
 * Ledenbeheer uses "second" (not "secondary") and "federation" for cross-federation club links.
 */
const ZWEIFFEL_MEMBERSHIP_TYPES = [
  "primary",
  "second",
  "federation",
] as const;

const ZWEIFFEL_SECONDARY_TYPES = new Set(["second", "federation"]);

export function allowsSecondaryMembers(
  competitionKindCode: string | null | undefined,
): boolean {
  return competitionKindCode === COMPETITION_KIND_CODES.ZWEIFFEL;
}

export function eligibleMembershipTypes(
  competitionKindCode?: string | null,
): readonly string[] {
  return allowsSecondaryMembers(competitionKindCode)
    ? ZWEIFFEL_MEMBERSHIP_TYPES
    : PRIMARY_ONLY;
}

/** Club-row candidate for Zweiffel (does not check active primary elsewhere). */
export function isEligibleMembershipRow(
  row: { membership_type?: unknown; status?: unknown },
  competitionKindCode?: string | null,
): boolean {
  const type = String(row.membership_type ?? "");
  const status = String(row.status ?? "");

  if (allowsSecondaryMembers(competitionKindCode)) {
    if (type === "primary") return status === ACTIVE_MEMBERSHIP_STATUS;
    if (ZWEIFFEL_SECONDARY_TYPES.has(type)) return true;
    return false;
  }

  return (
    type === ACTIVE_PRIMARY.membership_type &&
    status === ACTIVE_PRIMARY.status
  );
}

export function isZweiffelSecondaryMembershipType(
  membershipType: unknown,
): boolean {
  return ZWEIFFEL_SECONDARY_TYPES.has(String(membershipType ?? ""));
}

function withMembershipColumns(select: string): string {
  let next = select;
  if (!/(^|[, ])membership_type([, ]|$)/.test(next)) {
    next = `${next}, membership_type`;
  }
  if (!/(^|[, ])status([, ]|$)/.test(next)) {
    next = `${next}, status`;
  }
  return next;
}

function playerIdFromRow(row: Record<string, unknown>): string | null {
  const id = row.player_id;
  if (typeof id === "string" && id.length > 0) return id;
  return null;
}

/** Keep first eligible club-row per player_id when present. */
function filterEligibleClubRows<T extends Record<string, unknown>>(
  rows: T[],
  competitionKindCode?: string | null,
): T[] {
  const eligible = rows.filter((row) =>
    isEligibleMembershipRow(row, competitionKindCode),
  );
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const row of eligible) {
    const playerId = playerIdFromRow(row);
    if (playerId == null) {
      deduped.push(row);
      continue;
    }
    if (seen.has(playerId)) continue;
    seen.add(playerId);
    deduped.push(row);
  }
  return deduped;
}

async function loadPlayerIdsWithActivePrimary(
  supabase: SupabaseClient,
  playerIds: string[],
): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("player_club_memberships")
    .select("player_id")
    .in("player_id", playerIds)
    .eq("membership_type", ACTIVE_PRIMARY.membership_type)
    .eq("status", ACTIVE_PRIMARY.status);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.player_id as string));
}

/**
 * Zweiffel second/federation rows require an active primary membership elsewhere.
 * Active primary at the team club does not need that extra check.
 */
async function retainZweiffelEligibleRows<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  rows: T[],
): Promise<T[]> {
  const candidates = filterEligibleClubRows(rows, COMPETITION_KIND_CODES.ZWEIFFEL);
  const secondaryPlayerIds = [
    ...new Set(
      candidates
        .filter((row) => isZweiffelSecondaryMembershipType(row.membership_type))
        .map((row) => playerIdFromRow(row))
        .filter((id): id is string => id != null),
    ),
  ];
  const activePrimaryIds = await loadPlayerIdsWithActivePrimary(
    supabase,
    secondaryPlayerIds,
  );

  return candidates.filter((row) => {
    if (!isZweiffelSecondaryMembershipType(row.membership_type)) return true;
    const playerId = playerIdFromRow(row);
    return playerId != null && activePrimaryIds.has(playerId);
  });
}

/**
 * Load club members eligible for the competition kind.
 * Primary-only competitions: SQL filters active primary.
 * Zweiffel: club primary+active, or second/federation (any status) with active primary elsewhere.
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
    .select(withMembershipColumns(select))
    .eq("club_id", clubId);
  if (error) throw error;
  return (await retainZweiffelEligibleRows(
    supabase,
    (data ?? []) as unknown as Record<string, unknown>[],
  )) as T[];
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
    .select("id, player_id, membership_type, status")
    .eq("club_id", input.clubId)
    .eq("player_id", input.playerId);
  if (error) throw error;
  const rows: Record<string, unknown>[] = (data ?? []).map((row) => ({
    ...(row as Record<string, unknown>),
    player_id: input.playerId,
  }));
  const match = (await retainZweiffelEligibleRows(supabase, rows))[0];
  if (!match || typeof match.id !== "string") return null;
  return { id: match.id };
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
    .select("player_id, membership_type, status")
    .eq("club_id", clubId)
    .in("player_id", playerIds);
  if (error) throw error;
  const rows = await retainZweiffelEligibleRows(
    supabase,
    (data ?? []) as unknown as Record<string, unknown>[],
  );
  return new Set(
    rows
      .map((row) => row.player_id as string)
      .filter(Boolean),
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

import { isCompetitionKindCode } from "@/lib/auth/arbiter-scope";
import type { CompetitionKindCode } from "@/lib/auth/competition-scope";
import { createServiceClient } from "@/lib/supabase/server-client";

export type MatchCompetitionKind = {
  id: string;
  code: CompetitionKindCode;
};

type LeagueKindRow = {
  competition_kind_id?: string | null;
  competition_kinds?:
    | { code?: string | null }
    | { code?: string | null }[]
    | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Resolve competition kind id + code for a match via group → division → league.
 */
export async function loadMatchCompetitionKind(
  matchId: string,
): Promise<MatchCompetitionKind | null> {
  const supabase = createServiceClient();
  const { data: matchRow, error } = await supabase
    .from("matches")
    .select(
      "id, groups!inner(divisions!inner(leagues!inner(competition_kind_id, competition_kinds(code))))",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;

  const groups = matchRow?.groups as
    | { divisions: { leagues: LeagueKindRow } }
    | { divisions: { leagues: LeagueKindRow } }[]
    | null
    | undefined;
  const group = unwrapOne(groups);
  const division = unwrapOne(group?.divisions);
  const league = unwrapOne(division?.leagues);
  const kindId = league?.competition_kind_id ?? null;
  const kindRow = unwrapOne(league?.competition_kinds);
  const code = kindRow?.code?.trim() ?? null;

  if (!kindId || !code || !isCompetitionKindCode(code)) return null;
  return { id: kindId, code };
}

/** Convenience: competition kind code only (for Resend from selection). */
export async function loadMatchCompetitionKindCode(
  matchId: string,
): Promise<CompetitionKindCode | null> {
  const kind = await loadMatchCompetitionKind(matchId);
  return kind?.code ?? null;
}

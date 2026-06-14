import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorCodes, type ErrorCode } from "@/lib/http/error-codes";
import { requireActiveSeason } from "@/lib/competition/season";

export type PenaltyRow = {
  id: string;
  team_id: string;
  penalty_date: string;
  reason: string;
  vp_deduction: number;
  file_path: string | null;
  created_at: string;
  updated_at: string | null;
  team?: { id: string; name: string; group_id: string } | null;
};

export async function activeSeasonTeamIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const season = await requireActiveSeason(supabase);
  const { data: leagues, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", season.id);
  if (leagueError) throw leagueError;

  const leagueIds = leagues?.map((l) => l.id) ?? [];
  if (leagueIds.length === 0) return new Set();

  const { data: divisions, error: divError } = await supabase
    .from("divisions")
    .select("id")
    .in("league_id", leagueIds);
  if (divError) throw divError;

  const divisionIds = divisions?.map((d) => d.id) ?? [];
  if (divisionIds.length === 0) return new Set();

  const { data: groups, error: groupError } = await supabase
    .from("groups")
    .select("id")
    .in("division_id", divisionIds);
  if (groupError) throw groupError;

  const groupIds = groups?.map((g) => g.id) ?? [];
  if (groupIds.length === 0) return new Set();

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .in("group_id", groupIds);
  if (teamError) throw teamError;

  return new Set(teams?.map((t) => t.id) ?? []);
}

export async function teamIdsForGroupFilter(
  supabase: SupabaseClient,
  groupId: string | null,
  seasonTeamIds: Set<string>,
): Promise<Set<string>> {
  if (!groupId) return seasonTeamIds;

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("group_id", groupId);
  if (teamError) throw teamError;

  const groupTeamIds = new Set(teams?.map((t) => t.id) ?? []);
  return new Set([...seasonTeamIds].filter((id) => groupTeamIds.has(id)));
}

export function parsePenaltyInput(body: Record<string, unknown>): {
  teamId: string;
  penaltyDate: string;
  reason: string;
  vpDeduction: number;
  filePath: string | null;
} | { error: ErrorCode } {
  const teamId = body.team_id as string | undefined;
  const penaltyDate = body.penalty_date as string | undefined;
  const reason = body.reason as string | undefined;
  const vpDeduction = Number(body.vp_deduction);
  const filePathRaw = body.file_path ?? body.filePath;
  const filePath =
    filePathRaw != null && String(filePathRaw).trim() !== ""
      ? String(filePathRaw).trim()
      : null;

  if (!teamId || !penaltyDate || !reason?.trim()) {
    return { error: ErrorCodes.api.penaltyFieldsRequired };
  }
  if (!Number.isFinite(vpDeduction) || vpDeduction < 0) {
    return { error: ErrorCodes.api.vpDeductionNonNegative };
  }

  return {
    teamId,
    penaltyDate,
    reason: reason.trim(),
    vpDeduction,
    filePath,
  };
}

export function parsePenaltyInputList(
  items: unknown,
): Array<{
  teamId: string;
  penaltyDate: string;
  reason: string;
  vpDeduction: number;
  filePath: string | null;
}> | { error: ErrorCode } {
  if (items == null) return [];
  if (!Array.isArray(items)) {
    return { error: ErrorCodes.api.invalidRequestBody };
  }

  const parsed: Array<{
    teamId: string;
    penaltyDate: string;
    reason: string;
    vpDeduction: number;
    filePath: string | null;
  }> = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { error: ErrorCodes.api.invalidRequestBody };
    }
    const result = parsePenaltyInput(item as Record<string, unknown>);
    if ("error" in result) return result;
    parsed.push(result);
  }
  return parsed;
}

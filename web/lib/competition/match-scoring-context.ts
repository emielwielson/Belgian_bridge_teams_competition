import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompetitionScope } from "./scopes";
import type { DivisionLevelCode, ScoringContext } from "@/lib/scoring/board-count-rules";

export type GroupScoringContext = ScoringContext & {
  groupId: string;
  divisionLevelId: string;
};

export type MatchScoringContext = GroupScoringContext & {
  matchId: string;
  boardCount: number;
  vpBoardCount: number | null;
  selectedBoardCount: number | null;
  misSeating: boolean;
};

type GroupRow = {
  id: string;
  division: {
    division_level_id: string;
    division_level: { code: string } | { code: string }[];
    league: { scope: string } | { scope: string }[];
  } | {
    division_level_id: string;
    division_level: { code: string } | { code: string }[];
    league: { scope: string } | { scope: string }[];
  }[];
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function parseDivisionLevelCode(code: string): DivisionLevelCode {
  if (
    code === "honor" ||
    code === "first" ||
    code === "second" ||
    code === "third"
  ) {
    return code;
  }
  throw new Error(`Unknown division level code: ${code}`);
}

function parseScoringContextFromGroupRow(group: GroupRow): GroupScoringContext {
  const division = first(group.division);
  if (!division) throw new Error("Group has no division");

  const divisionLevel = first(division.division_level);
  const league = first(division.league);
  if (!divisionLevel || !league) {
    throw new Error("Group division is missing level or league");
  }

  const leagueScope = league.scope as CompetitionScope;
  if (leagueScope !== "national" && leagueScope !== "regional") {
    throw new Error(`Unknown league scope: ${league.scope}`);
  }

  return {
    groupId: group.id,
    divisionLevelId: division.division_level_id,
    leagueScope,
    divisionLevelCode: parseDivisionLevelCode(divisionLevel.code),
  };
}

const GROUP_SCORING_SELECT = `
  id,
  division:divisions (
    division_level_id,
    division_level:division_levels ( code ),
    league:leagues ( scope )
  )
`;

export async function loadGroupScoringContext(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupScoringContext> {
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SCORING_SELECT)
    .eq("id", groupId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Group not found");

  return parseScoringContextFromGroupRow(data as GroupRow);
}

export async function loadMatchScoringContext(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchScoringContext> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      group_id,
      board_count,
      vp_board_count,
      selected_board_count,
      mis_seating
    `,
    )
    .eq("id", matchId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Match not found");

  const scoring = await loadGroupScoringContext(supabase, data.group_id);

  return {
    ...scoring,
    matchId: data.id,
    boardCount: data.board_count,
    vpBoardCount: data.vp_board_count,
    selectedBoardCount: data.selected_board_count,
    misSeating: data.mis_seating ?? false,
  };
}

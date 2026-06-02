import type { SupabaseClient } from "@supabase/supabase-js";

export const SCHEDULE_SLOT_COUNT = 8;

export type ScheduleSlotRow = {
  slot: number;
  teamId: string | null;
  isBye: boolean;
  teamName?: string | null;
};

export type ScheduleSlotPayload = {
  slot: number;
  teamId?: string | null;
  isBye?: boolean;
};

export type GroupScheduleSlotsState = {
  slots: ScheduleSlotRow[];
  unassignedTeams: { id: string; name: string }[];
  teamCount: number;
  slotsComplete: boolean;
  usesRbbfTemplate: boolean;
};

export function emptyScheduleSlots(): ScheduleSlotRow[] {
  return Array.from({ length: SCHEDULE_SLOT_COUNT }, (_, i) => ({
    slot: i + 1,
    teamId: null,
    isBye: false,
    teamName: null,
  }));
}

export function usesRbbfTemplate(
  scope: string,
  teamCount: number,
  slots: ScheduleSlotRow[],
): boolean {
  const filled = slots.filter((s) => s.isBye || s.teamId).length;
  const byeCount = slots.filter((s) => s.isBye).length;

  if (scope === "national") {
    if (teamCount !== 7 && teamCount !== 8) return false;
    return (
      filled === SCHEDULE_SLOT_COUNT &&
      byeCount === (teamCount === 7 ? 1 : 0)
    );
  }

  if (teamCount === 8) return true;
  if (teamCount === 7 && byeCount === 1 && filled === SCHEDULE_SLOT_COUNT) {
    return true;
  }
  return false;
}

export function slotsAreComplete(
  teamCount: number,
  slots: ScheduleSlotRow[],
): boolean {
  const filled = slots.filter((s) => s.isBye || s.teamId).length;
  if (filled !== SCHEDULE_SLOT_COUNT) return false;
  const byeCount = slots.filter((s) => s.isBye).length;
  if (teamCount === 7) return byeCount === 1;
  if (teamCount === 8) return byeCount === 0;
  return false;
}

export function validateSlotPayload(
  teamCount: number,
  teamIds: string[],
  slots: ScheduleSlotPayload[],
  options?: { requireComplete?: boolean },
): string | null {
  if (teamCount < 7 || teamCount > 8) {
    return "Schedule slots apply only to groups with 7 or 8 teams";
  }

  if (slots.length !== SCHEDULE_SLOT_COUNT) {
    return `Expected ${SCHEDULE_SLOT_COUNT} slots`;
  }

  const slotNumbers = new Set<number>();
  const assignedTeamIds = new Set<string>();
  let byeCount = 0;
  let assignedTeamCount = 0;

  for (const row of slots) {
    if (row.slot < 1 || row.slot > SCHEDULE_SLOT_COUNT) {
      return `Invalid slot number: ${row.slot}`;
    }
    if (slotNumbers.has(row.slot)) {
      return `Duplicate slot: ${row.slot}`;
    }
    slotNumbers.add(row.slot);

    const isBye = row.isBye === true;
    const teamId = row.teamId ?? null;

    if (isBye && teamId) {
      return "Bye slot cannot have a team";
    }
    if (isBye) {
      byeCount += 1;
      continue;
    }
    if (teamId) {
      if (!teamIds.includes(teamId)) {
        return "Team does not belong to this group";
      }
      if (assignedTeamIds.has(teamId)) {
        return "Each team can only occupy one slot";
      }
      assignedTeamIds.add(teamId);
      assignedTeamCount += 1;
    }
  }

  if (byeCount > 1) {
    return "Only one bye slot is allowed";
  }

  if (teamCount === 8 && byeCount > 0) {
    return "Groups with 8 teams cannot have a bye slot";
  }

  if (options?.requireComplete) {
    if (teamCount === 7) {
      if (byeCount !== 1) {
        return "Groups with 7 teams require exactly one bye slot";
      }
      if (assignedTeamCount !== 7) {
        return "All 7 teams must be assigned to slots";
      }
    } else if (assignedTeamCount !== 8) {
      return "All 8 teams must be assigned to slots";
    }
  }

  return null;
}

export function buildScheduleSlotsState(
  teams: { id: string; name: string }[],
  dbRows: { slot: number; team_id: string | null; is_bye: boolean }[],
): GroupScheduleSlotsState {
  const teamById = new Map(teams.map((t) => [t.id, t.name]));
  const slots = emptyScheduleSlots();

  for (const row of dbRows) {
    const idx = row.slot - 1;
    if (idx < 0 || idx >= SCHEDULE_SLOT_COUNT) continue;
    slots[idx] = {
      slot: row.slot,
      teamId: row.team_id,
      isBye: row.is_bye,
      teamName: row.team_id ? (teamById.get(row.team_id) ?? null) : null,
    };
  }

  const assignedIds = new Set(
    slots.filter((s) => s.teamId).map((s) => s.teamId as string),
  );
  const unassignedTeams = teams
    .filter((t) => !assignedIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name }));

  const scopePlaceholder = "regional";
  return {
    slots,
    unassignedTeams,
    teamCount: teams.length,
    slotsComplete: slotsAreComplete(teams.length, slots),
    usesRbbfTemplate: usesRbbfTemplate(scopePlaceholder, teams.length, slots),
  };
}

export async function seedGroupScheduleSlotsIfEmpty(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  const { count, error: countError } = await supabase
    .from("group_schedule_slots")
    .select("slot", { count: "exact", head: true })
    .eq("group_id", groupId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) return;

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at");

  if (teamsError) throw new Error(teamsError.message);
  if (!teams?.length) return;

  const rows = Array.from({ length: SCHEDULE_SLOT_COUNT }, (_, i) => {
    const team = teams[i];
    return {
      group_id: groupId,
      slot: i + 1,
      team_id: team?.id ?? null,
      is_bye: false,
    };
  });

  const { error: insertError } = await supabase
    .from("group_schedule_slots")
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
}

export async function loadGroupScheduleSlots(
  supabase: SupabaseClient,
  groupId: string,
  options?: { autoSeed?: boolean },
): Promise<GroupScheduleSlotsState & { scope: string }> {
  if (options?.autoSeed !== false) {
    await seedGroupScheduleSlotsIfEmpty(supabase, groupId);
  }

  const { data: groupRow, error: groupError } = await supabase
    .from("groups")
    .select(
      "division:divisions ( league:leagues ( scope ) )",
    )
    .eq("id", groupId)
    .single();

  if (groupError) throw new Error(groupError.message);

  const division = Array.isArray(groupRow.division)
    ? groupRow.division[0]
    : groupRow.division;
  const leagueRow = division?.league;
  const league = Array.isArray(leagueRow) ? leagueRow[0] : leagueRow;
  const scope = (league as { scope?: string } | undefined)?.scope ?? "regional";

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("group_id", groupId)
    .order("created_at");

  if (teamsError) throw new Error(teamsError.message);

  const { data: slotRows, error: slotsError } = await supabase
    .from("group_schedule_slots")
    .select("slot, team_id, is_bye")
    .eq("group_id", groupId)
    .order("slot");

  if (slotsError) throw new Error(slotsError.message);

  const state = buildScheduleSlotsState(teams ?? [], slotRows ?? []);
  return {
    ...state,
    scope,
    usesRbbfTemplate: usesRbbfTemplate(scope, state.teamCount, state.slots),
  };
}

export async function saveGroupScheduleSlots(
  supabase: SupabaseClient,
  groupId: string,
  slots: ScheduleSlotPayload[],
): Promise<void> {
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("group_id", groupId);

  if (teamsError) throw new Error(teamsError.message);

  const teamIds = (teams ?? []).map((t) => t.id);
  const validationError = validateSlotPayload(teamIds.length, teamIds, slots);
  if (validationError) throw new Error(validationError);

  const { count: matchCount, error: matchError } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);

  if (matchError) throw new Error(matchError.message);
  if ((matchCount ?? 0) > 0) {
    throw new Error("Cannot change schedule slots after fixtures are generated");
  }

  const { error: deleteError } = await supabase
    .from("group_schedule_slots")
    .delete()
    .eq("group_id", groupId);

  if (deleteError) throw new Error(deleteError.message);

  const rows = slots.map((s) => ({
    group_id: groupId,
    slot: s.slot,
    team_id: s.isBye ? null : (s.teamId ?? null),
    is_bye: s.isBye === true,
  }));

  const { error: insertError } = await supabase
    .from("group_schedule_slots")
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
}

export async function loadSlotAssignmentsForGeneration(
  supabase: SupabaseClient,
  groupId: string,
  teamIds: string[],
): Promise<ScheduleSlotRow[] | null> {
  const { data: slotRows, error } = await supabase
    .from("group_schedule_slots")
    .select("slot, team_id, is_bye")
    .eq("group_id", groupId)
    .order("slot");

  if (error) throw new Error(error.message);
  if (!slotRows?.length) return null;

  const slots = emptyScheduleSlots();
  for (const row of slotRows) {
    const idx = row.slot - 1;
    if (idx >= 0 && idx < SCHEDULE_SLOT_COUNT) {
      slots[idx] = {
        slot: row.slot,
        teamId: row.team_id,
        isBye: row.is_bye,
      };
    }
  }

  if (!slotsAreComplete(teamIds.length, slots)) {
    return null;
  }

  return slots;
}

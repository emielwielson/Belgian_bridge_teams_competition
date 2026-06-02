import type { SupabaseClient } from "@supabase/supabase-js";

export class TeamCaptainError extends Error {
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = "TeamCaptainError";
  }
}

export class TeamValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "TeamValidationError";
  }
}

export type TeamCreateInput = {
  group_id: string;
  club_id: string;
  name: string;
  captain_id: string;
};

export function validateTeamCreateBody(body: unknown): TeamCreateInput {
  if (!body || typeof body !== "object") {
    throw new TeamValidationError("Invalid request body");
  }
  const b = body as Record<string, unknown>;
  const group_id = typeof b.group_id === "string" ? b.group_id.trim() : "";
  const club_id = typeof b.club_id === "string" ? b.club_id.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const captain_id =
    typeof b.captain_id === "string" ? b.captain_id.trim() : "";

  if (!group_id) throw new TeamValidationError("group_id is required");
  if (!club_id) throw new TeamValidationError("club_id is required");
  if (!name) throw new TeamValidationError("Team name is required");
  if (!captain_id) throw new TeamValidationError("captain_id is required");

  return { group_id, club_id, name, captain_id };
}

export async function assertCaptainIsClubMember(
  supabase: SupabaseClient,
  input: { clubId: string; playerId: string; seasonId: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("player_club_memberships")
    .select("id")
    .eq("club_id", input.clubId)
    .eq("player_id", input.playerId)
    .eq("season_id", input.seasonId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new TeamCaptainError("Captain must be a member of the team's club");
  }
}

export function parseCaptainId(body: unknown): string | null | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  if (!("captain_id" in b)) return undefined;
  if (b.captain_id === null || b.captain_id === "") return null;
  if (typeof b.captain_id !== "string" || !b.captain_id.trim()) {
    throw new TeamValidationError("captain_id must be a valid player id");
  }
  return b.captain_id.trim();
}

const ACTIVE_TEAM_STORAGE_KEY = "bridge-active-team-id";

export function readActiveTeamId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeActiveTeamId(teamId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, teamId);
  } catch {
    // ignore quota / private mode
  }
}

/** Prefer a stored team when it is still in the user's teams; otherwise the first team. */
export function resolveActiveTeamId(
  teams: ReadonlyArray<{ id: string }>,
): string | null {
  if (teams.length === 0) return null;
  const stored = readActiveTeamId();
  if (stored && teams.some((t) => t.id === stored)) return stored;
  return teams[0]?.id ?? null;
}

export const ROLES = {
  PLAYER: "player",
  CAPTAIN: "captain",
  CLUB_MANAGER: "club_manager",
  ARBITER: "arbiter",
  COMPETITION_MANAGER: "competition_manager",
  SYSTEM_ADMIN: "system_admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles that may use the arbiter inbox and resolve captain requests. */
export const ARBITER_ACCESS_ROLES = [
  ROLES.ARBITER,
  ROLES.COMPETITION_MANAGER,
] as const;

/** Roles that may edit scores after a match is played. */
export const FINISHED_SCORE_EDIT_ROLES = [
  ...ARBITER_ACCESS_ROLES,
  ROLES.SYSTEM_ADMIN,
] as const;

export function hasRole(userRoles: string[], role: string): boolean {
  if (userRoles.includes(ROLES.SYSTEM_ADMIN)) return true;
  return userRoles.includes(role);
}

export function hasAnyRole(userRoles: string[], required: string[]): boolean {
  if (userRoles.includes(ROLES.SYSTEM_ADMIN)) return true;
  return required.some((role) => userRoles.includes(role));
}

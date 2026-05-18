import type { Season } from "./season";

export class SetupLockedError extends Error {
  readonly status = 409;

  constructor(message = "Season is active; setup changes are locked") {
    super(message);
    this.name = "SetupLockedError";
  }
}

export function requireSeasonInSetup(season: Season): void {
  if (season.status !== "setup") {
    throw new SetupLockedError();
  }
}

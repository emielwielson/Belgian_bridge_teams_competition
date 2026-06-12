import { AuthError } from "@/lib/auth/route-auth";
import { NationalNotReadyError } from "@/lib/competition/national-readiness";
import { RosterLockedError } from "@/lib/competition/league-roster-lock";
import { SetupLockedError } from "@/lib/competition/season-setup";
import {
  TeamCaptainError,
  TeamValidationError,
} from "@/lib/competition/team-captain";
import { BoardCountValidationError } from "@/lib/scoring/board-count-rules";
import { LineupValidationError } from "@/lib/scoring/match-operations";
import { VpLookupError } from "@/lib/scoring/vp-lookup";

export function statusForError(err: unknown): number {
  if (err instanceof AuthError) return err.status;
  if (err instanceof SetupLockedError) return err.status;
  if (err instanceof RosterLockedError) return err.status;
  if (err instanceof TeamCaptainError) return err.status;
  if (err instanceof TeamValidationError) return err.status;
  if (err instanceof NationalNotReadyError) return err.status;
  if (err instanceof VpLookupError) return 400;
  if (err instanceof LineupValidationError) return 400;
  if (err instanceof BoardCountValidationError) return 400;
  if (err instanceof Error && err.message.includes("must have at least")) {
    return 400;
  }
  if (
    err instanceof Error &&
    err.message.includes("max_matches_per_day_per_team")
  ) {
    return 409;
  }
  if (err instanceof Error && err.message.includes("Postponement")) {
    return 400;
  }
  if (err instanceof Error && err.message.includes("captain")) {
    return 403;
  }
  if (err instanceof Error && err.message.includes("Authentication required")) {
    return 401;
  }
  return 500;
}

export function messageForError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Internal server error";
}

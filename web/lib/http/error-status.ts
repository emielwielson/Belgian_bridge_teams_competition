import { AuthError } from "@/lib/auth/route-auth";
import { NationalNotReadyError } from "@/lib/competition/national-readiness";
import { SetupLockedError } from "@/lib/competition/season-setup";
import { LineupValidationError } from "@/lib/scoring/match-operations";
import { VpLookupError } from "@/lib/scoring/vp-lookup";

export function statusForError(err: unknown): number {
  if (err instanceof AuthError) return err.status;
  if (err instanceof SetupLockedError) return err.status;
  if (err instanceof NationalNotReadyError) return err.status;
  if (err instanceof VpLookupError) return 400;
  if (err instanceof LineupValidationError) return 400;
  if (err instanceof Error && err.message.includes("must have at least")) {
    return 400;
  }
  return 500;
}

export function messageForError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Internal server error";
}

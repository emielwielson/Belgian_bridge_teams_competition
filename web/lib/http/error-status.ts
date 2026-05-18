import { AuthError } from "@/lib/auth/route-auth";
import { NationalNotReadyError } from "@/lib/competition/national-readiness";
import { SetupLockedError } from "@/lib/competition/season-setup";

export function statusForError(err: unknown): number {
  if (err instanceof AuthError) return err.status;
  if (err instanceof SetupLockedError) return err.status;
  if (err instanceof NationalNotReadyError) return err.status;
  return 500;
}

export function messageForError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Internal server error";
}

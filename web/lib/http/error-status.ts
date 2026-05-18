import { AuthError } from "@/lib/auth/route-auth";

export function statusForError(err: unknown): number {
  if (err instanceof AuthError) return err.status;
  return 500;
}

export function messageForError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Internal server error";
}

import { NextResponse } from "next/server";
import { messageForError, statusForError } from "./error-status";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonFromError(err: unknown) {
  return jsonError(messageForError(err), statusForError(err));
}

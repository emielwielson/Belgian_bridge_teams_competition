import { NextResponse } from "next/server";
import { codeForError, paramsForError } from "./code-for-error";
import type { ErrorCode } from "./error-codes";
import { messageForError, statusForError } from "./error-status";

export type ApiErrorBody = {
  error: ErrorCode | string;
  errorParams?: Record<string, string | number>;
};

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message } satisfies ApiErrorBody, { status });
}

export function jsonErrorCode(
  code: ErrorCode,
  status: number,
  params?: Record<string, string | number>,
) {
  const body: ApiErrorBody = params ? { error: code, errorParams: params } : { error: code };
  return NextResponse.json(body, { status });
}

export function jsonFromError(err: unknown) {
  const code = codeForError(err);
  if (code) {
    return jsonErrorCode(code, statusForError(err), paramsForError(err));
  }
  return jsonError(messageForError(err), statusForError(err));
}

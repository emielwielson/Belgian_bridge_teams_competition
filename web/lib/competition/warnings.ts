import { ErrorCodes, type ErrorCode } from "@/lib/http/error-codes";

export type WarningRow = {
  id: string;
  team_id: string;
  warning_date: string;
  reason: string;
  created_at: string;
  updated_at: string | null;
  team?: { id: string; name: string; group_id: string } | null;
};

export function parseWarningInput(body: Record<string, unknown>): {
  teamId: string;
  warningDate: string;
  reason: string;
} | { error: ErrorCode } {
  const teamId = body.team_id as string | undefined;
  const warningDate = body.warning_date as string | undefined;
  const reason = body.reason as string | undefined;

  if (!teamId || !warningDate || !reason?.trim()) {
    return { error: ErrorCodes.api.teamWarningFieldsRequired };
  }

  return {
    teamId,
    warningDate,
    reason: reason.trim(),
  };
}

export function parseWarningInputList(
  items: unknown,
): Array<{ teamId: string; warningDate: string; reason: string }> | { error: ErrorCode } {
  if (items == null) return [];
  if (!Array.isArray(items)) {
    return { error: ErrorCodes.api.invalidRequestBody };
  }

  const parsed: Array<{ teamId: string; warningDate: string; reason: string }> = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { error: ErrorCodes.api.invalidRequestBody };
    }
    const result = parseWarningInput(item as Record<string, unknown>);
    if ("error" in result) return result;
    parsed.push(result);
  }
  return parsed;
}

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/route-auth";
import { loadMatchContext } from "@/lib/auth/match-access";
import {
  canAccessPostponementWorkflow,
  getMatchPostponementState,
  proposeMatchPostponement,
  respondMatchPostponement,
} from "@/lib/competition/postponement";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { sendPostponementProposedEmail } from "@/lib/notifications/postponement-email";
import { parseBrusselsToUtc } from "@/lib/time/brussels";

type Params = { params: Promise<{ matchId: string }> };

function parseProposedDatetime(body: Record<string, unknown>): string | null {
  const raw =
    body.proposed_datetime ?? body.proposedDatetime ?? body.datetime_local;
  if (typeof raw !== "string" || !raw.trim()) return null;
  if (raw.includes("T") && !raw.endsWith("Z") && !raw.includes("+")) {
    return parseBrusselsToUtc(raw);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const state = await getMatchPostponementState(supabase, matchId);

    if (!state) {
      return jsonError("Match not found", 404);
    }

    if (!canAccessPostponementWorkflow(state)) {
      return jsonError("Forbidden", 403);
    }

    return jsonOk({ state });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const body = (await request.json()) as Record<string, unknown>;

    const proposedDatetime = parseProposedDatetime(body);
    const proposingTeamId = String(
      body.proposing_team_id ?? body.proposingTeamId ?? "",
    );

    if (!proposedDatetime || !proposingTeamId) {
      return jsonError("proposed_datetime and proposing_team_id are required", 400);
    }

    const match = await loadMatchContext(supabase, matchId);
    const previousDatetime = match.datetime;

    await proposeMatchPostponement(
      supabase,
      matchId,
      proposedDatetime,
      proposingTeamId,
    );

    const state = await getMatchPostponementState(supabase, matchId);

    const proposingTeamName =
      proposingTeamId === match.home_team_id
        ? match.home_team.name
        : match.away_team.name;

    void sendPostponementProposedEmail(
      {
        matchId,
        round: match.round,
        homeTeamName: match.home_team.name,
        awayTeamName: match.away_team.name,
        previousDatetime,
        proposedDatetime,
        proposingTeamName,
      },
      match.home_team_id,
      match.away_team_id,
    );

    return jsonOk({ state });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const body = (await request.json()) as Record<string, unknown>;

    const requestId = String(body.request_id ?? body.requestId ?? "");
    const action = body.action as string;

    if (!requestId || !["approve", "reject", "cancel"].includes(action)) {
      return jsonError("request_id and action (approve|reject|cancel) are required", 400);
    }

    const matchBefore = await loadMatchContext(supabase, matchId);

    await respondMatchPostponement(
      supabase,
      requestId,
      action as "approve" | "reject" | "cancel",
    );

    const state = await getMatchPostponementState(supabase, matchId);

    if (action === "approve") {
      await revalidateStandingsForGroup(supabase, matchBefore.group_id);
      revalidatePath(`/matches/${matchId}`);
    }

    return jsonOk({ state });
  } catch (err) {
    return jsonFromError(err);
  }
}

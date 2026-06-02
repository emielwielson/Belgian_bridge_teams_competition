import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireAuth } from "@/lib/auth/route-auth";
import { loadMatchContext } from "@/lib/auth/match-access";
import {
  canAccessHomeAwaySwitchWorkflow,
  getMatchHomeAwaySwitchState,
  proposeMatchHomeAwaySwitch,
  respondMatchHomeAwaySwitch,
} from "@/lib/competition/home-away-switch";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import {
  sendHomeAwaySwitchDecisionEmail,
  sendHomeAwaySwitchProposedEmail,
} from "@/lib/notifications/home-away-switch-email";

type Params = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const state = await getMatchHomeAwaySwitchState(supabase, matchId);

    if (!state) {
      return jsonErrorCode(ErrorCodes.api.matchNotFound, 404);
    }

    if (!canAccessHomeAwaySwitchWorkflow(state)) {
      return jsonErrorCode(ErrorCodes.api.homeAwayNotAvailable, 403);
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
    const match = await loadMatchContext(supabase, matchId);

    const requestingTeamId = String(
      body.requesting_team_id ?? body.requestingTeamId ?? "",
    );

    if (!requestingTeamId) {
      return jsonErrorCode(ErrorCodes.api.requestingTeamIdRequired, 400);
    }

    await proposeMatchHomeAwaySwitch(supabase, matchId, requestingTeamId);
    const state = await getMatchHomeAwaySwitchState(supabase, matchId);

    const requestingTeamName =
      requestingTeamId === match.home_team_id
        ? match.home_team.name
        : match.away_team.name;
    const locale = await getLocale();
    void sendHomeAwaySwitchProposedEmail(
      {
        matchId,
        round: match.round,
        homeTeamName: match.home_team.name,
        awayTeamName: match.away_team.name,
        requestingTeamName,
      },
      match.home_team_id,
      match.away_team_id,
      locale,
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
      return jsonErrorCode(ErrorCodes.api.postponeActionRequired, 400);
    }

    const matchBefore = await loadMatchContext(supabase, matchId);
    const stateBefore = await getMatchHomeAwaySwitchState(supabase, matchId);

    await respondMatchHomeAwaySwitch(
      supabase,
      requestId,
      action as "approve" | "reject" | "cancel",
    );

    const state = await getMatchHomeAwaySwitchState(supabase, matchId);

    if (action === "approve") {
      await revalidateStandingsForGroup(supabase, matchBefore.group_id);
      revalidatePath(`/matches/${matchId}`);
    }

    const requestingTeamId = stateBefore?.pending?.requesting_team_id;
    if (requestingTeamId) {
      const requestingTeamName =
        requestingTeamId === matchBefore.home_team_id
          ? matchBefore.home_team.name
          : matchBefore.away_team.name;
      const locale = await getLocale();
      void sendHomeAwaySwitchDecisionEmail(
        {
          matchId,
          round: matchBefore.round,
          homeTeamName: matchBefore.home_team.name,
          awayTeamName: matchBefore.away_team.name,
          requestingTeamName,
          action: action as "approve" | "reject" | "cancel",
        },
        matchBefore.home_team_id,
        matchBefore.away_team_id,
        locale,
      );
    }

    return jsonOk({ state });
  } catch (err) {
    return jsonFromError(err);
  }
}

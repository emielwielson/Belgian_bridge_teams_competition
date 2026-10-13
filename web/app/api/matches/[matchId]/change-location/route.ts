import { getLocale } from "next-intl/server";
import { requireAuth } from "@/lib/auth/route-auth";
import { loadMatchContext } from "@/lib/auth/match-access";
import {
  canAccessLocationChangeWorkflow,
  getMatchLocationChangeState,
  proposeMatchLocationChange,
  respondMatchLocationChange,
} from "@/lib/competition/location-change";
import { revalidateMatchDerivedViews } from "@/lib/competition/revalidate-standings";
import { jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import {
  sendLocationChangeDecisionEmail,
  sendLocationChangeProposedEmail,
} from "@/lib/notifications/location-change-email";

type Params = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const state = await getMatchLocationChangeState(supabase, matchId);

    if (!state) {
      return jsonErrorCode(ErrorCodes.api.matchNotFound, 404);
    }

    if (!canAccessLocationChangeWorkflow(state)) {
      return jsonErrorCode(ErrorCodes.api.locationChangeNotAvailable, 403);
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

    const proposingTeamId = String(
      body.proposing_team_id ?? body.proposingTeamId ?? "",
    );
    const proposedLocation = String(
      body.proposed_location ?? body.proposedLocation ?? "",
    ).trim();

    if (!proposingTeamId) {
      return jsonErrorCode(ErrorCodes.api.proposingTeamIdRequired, 400);
    }
    if (!proposedLocation) {
      return jsonErrorCode(ErrorCodes.api.proposedLocationRequired, 400);
    }

    await proposeMatchLocationChange(
      supabase,
      matchId,
      proposedLocation,
      proposingTeamId,
    );
    const state = await getMatchLocationChangeState(supabase, matchId);

    const proposingTeamName =
      proposingTeamId === match.home_team_id
        ? match.home_team.name
        : match.away_team.name;
    const locale = await getLocale();
    await sendLocationChangeProposedEmail(
      {
        matchId,
        round: match.round,
        homeTeamName: match.home_team.name,
        awayTeamName: match.away_team.name,
        proposingTeamName,
        proposingTeamId,
        proposedLocation,
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
    const stateBefore = await getMatchLocationChangeState(supabase, matchId);

    await respondMatchLocationChange(
      supabase,
      requestId,
      action as "approve" | "reject" | "cancel",
    );

    const state = await getMatchLocationChangeState(supabase, matchId);

    if (action === "approve") {
      await revalidateMatchDerivedViews(supabase, matchBefore);
    }

    const proposingTeamId = stateBefore?.pending?.proposing_team_id;
    const proposedLocation = stateBefore?.pending?.proposed_location;
    if (proposingTeamId && proposedLocation) {
      const proposingTeamName =
        proposingTeamId === matchBefore.home_team_id
          ? matchBefore.home_team.name
          : matchBefore.away_team.name;
      const locale = await getLocale();
      await sendLocationChangeDecisionEmail(
        {
          matchId,
          round: matchBefore.round,
          homeTeamName: matchBefore.home_team.name,
          awayTeamName: matchBefore.away_team.name,
          proposingTeamName,
          proposingTeamId,
          proposedLocation,
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

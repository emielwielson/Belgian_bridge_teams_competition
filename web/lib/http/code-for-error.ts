import { AuthError } from "@/lib/auth/route-auth";
import { TeamCaptainError, TeamValidationError } from "@/lib/competition/team-captain";
import { ErrorCodes, type ErrorCode } from "./error-codes";

const AUTH_MESSAGE_TO_CODE: Record<string, ErrorCode> = {
  Unauthorized: ErrorCodes.api.unauthorized,
  Forbidden: ErrorCodes.api.forbidden,
  "Match not found": ErrorCodes.auth.matchNotFound,
  "Match teams not found": ErrorCodes.auth.matchTeamsNotFound,
  "Forbidden: cannot access this match": ErrorCodes.auth.cannotAccessMatch,
  "Cannot edit lineup after match is played":
    ErrorCodes.auth.cannotEditLineupAfterPlayed,
  "Forbidden: cannot edit lineup for this match":
    ErrorCodes.auth.cannotEditLineup,
  "Match already scored; use admin edit": ErrorCodes.auth.matchAlreadyScored,
  "Forbidden: cannot submit score for this match":
    ErrorCodes.auth.cannotSubmitScore,
  "Forbidden: only arbiters or competition managers can edit official scores":
    ErrorCodes.auth.onlyArbiterOrManagerEditScore,
  "Forbidden: not assigned to this club": ErrorCodes.auth.notAssignedClub,
  "Forbidden: cannot manage convention cards for this team":
    ErrorCodes.auth.cannotManageConventionCards,
  "Forbidden: cannot manage roster for this team": ErrorCodes.api.forbidden,
};

const MESSAGE_TO_CODE: Record<string, ErrorCode> = {
  "File is empty": ErrorCodes.files.empty,
  "File must be 10 MB or smaller": ErrorCodes.files.tooLarge,
  "File must be a PDF or image (JPEG, PNG, WebP)": ErrorCodes.files.invalidType,
  "Unsupported file type": ErrorCodes.files.unsupportedType,
  "Team not found": ErrorCodes.api.teamNotFound,
  "Match not found": ErrorCodes.api.matchNotFound,
  Forbidden: ErrorCodes.api.forbidden,
  "Schedule slots apply only to groups with 7 or 8 teams":
    ErrorCodes.scheduleSlots.onlySevenOrEight,
  "Bye slot cannot have a team": ErrorCodes.scheduleSlots.byeCannotHaveTeam,
  "Team does not belong to this group": ErrorCodes.scheduleSlots.teamNotInGroup,
  "Each team can only occupy one slot": ErrorCodes.scheduleSlots.teamOneSlot,
  "Only one bye slot is allowed": ErrorCodes.scheduleSlots.onlyOneBye,
  "Groups with 8 teams cannot have a bye slot":
    ErrorCodes.scheduleSlots.eightTeamsNoBye,
  "Groups with 7 teams require exactly one bye slot":
    ErrorCodes.scheduleSlots.sevenTeamsOneBye,
  "All 7 teams must be assigned to slots":
    ErrorCodes.scheduleSlots.sevenTeamsAllAssigned,
  "All 8 teams must be assigned to slots":
    ErrorCodes.scheduleSlots.eightTeamsAllAssigned,
  "Cannot change schedule slots after fixtures are generated":
    ErrorCodes.scheduleSlots.cannotChangeAfterFixtures,
  "Captain must be a member of the team's club":
    ErrorCodes.api.captainNotClubMember,
  "Invalid request body": ErrorCodes.api.invalidRequestBody,
  "group_id is required": ErrorCodes.api.groupIdRequired,
  "club_id is required": ErrorCodes.api.clubIdRequired,
  "Team name is required": ErrorCodes.api.teamNameRequired,
  "captain_id is required": ErrorCodes.api.captainIdRequired,
  "captain_id must be a valid player id": ErrorCodes.api.captainIdInvalid,
  "Captain is already on another team this season; remove them from that roster first":
    ErrorCodes.api.captainAlreadyOnAnotherTeam,
  "Cannot remove the team captain from the roster":
    ErrorCodes.api.cannotRemoveCaptain,
  "Season is active; setup changes are locked": ErrorCodes.api.seasonSetupLocked,
};

const NATIONAL_EXPECTED_DAYS = /^Expected (\d+) match days for (\w+), got (\d+)$/;
const NATIONAL_MISSING_DATE = /^Match day (\d+) is missing a date$/;
const NATIONAL_TEAMS_LIMIT = /^National groups allow exactly (\d+) teams$/;

export function paramsForError(err: unknown): Record<string, string | number> | undefined {
  if (!(err instanceof Error)) return undefined;

  const expectedDays = err.message.match(NATIONAL_EXPECTED_DAYS);
  if (expectedDays) {
    return {
      expected: Number(expectedDays[1]),
      scheduleKey: expectedDays[2],
      actual: Number(expectedDays[3]),
    };
  }

  const missingDate = err.message.match(NATIONAL_MISSING_DATE);
  if (missingDate) {
    return { round: Number(missingDate[1]) };
  }

  const teamsLimit = err.message.match(NATIONAL_TEAMS_LIMIT);
  if (teamsLimit) {
    return { count: Number(teamsLimit[1]) };
  }

  return undefined;
}

export function codeForError(err: unknown): ErrorCode | null {
  if (err instanceof AuthError) {
    return (
      AUTH_MESSAGE_TO_CODE[err.message] ??
      (err.status === 401
        ? ErrorCodes.api.unauthorized
        : ErrorCodes.api.forbidden)
    );
  }

  if (err instanceof TeamCaptainError) {
    return MESSAGE_TO_CODE[err.message] ?? ErrorCodes.api.captainNotClubMember;
  }

  if (err instanceof TeamValidationError) {
    return MESSAGE_TO_CODE[err.message] ?? null;
  }

  if (err instanceof Error) {
    const direct = MESSAGE_TO_CODE[err.message];
    if (direct) return direct;

    if (NATIONAL_EXPECTED_DAYS.test(err.message)) {
      return ErrorCodes.nationalMatchDays.expectedDays;
    }
    if (NATIONAL_MISSING_DATE.test(err.message)) {
      return ErrorCodes.nationalMatchDays.missingDate;
    }
    if (NATIONAL_TEAMS_LIMIT.test(err.message)) {
      return ErrorCodes.api.nationalTeamsLimit;
    }
  }

  return null;
}

/** Machine-readable API error codes; messages live in `messages/en.json` under `errors`. */
export const ErrorCodes = {
  api: {
    unauthorized: "api.unauthorized",
    forbidden: "api.forbidden",
    matchNotFound: "api.matchNotFound",
    teamNotFound: "api.teamNotFound",
    clubNotFound: "api.clubNotFound",
    penaltyNotFound: "api.penaltyNotFound",
    rulingNotFound: "api.rulingNotFound",
    warningNotFound: "api.warningNotFound",
    conventionCardNotFound: "api.conventionCardNotFound",
    matchIdAndFileRequired: "api.matchIdAndFileRequired",
    boardPositiveInteger: "api.boardPositiveInteger",
    boardPositive: "api.boardPositive",
    matchNotActiveSeason: "api.matchNotActiveSeason",
    impsMustBeNumbers: "api.impsMustBeNumbers",
    noOfficialScoreUsePost: "api.noOfficialScoreUsePost",
    filePathRequired: "api.filePathRequired",
    vpDeductionNonNegative: "api.vpDeductionNonNegative",
    fileRequired: "api.fileRequired",
    purposeRequired: "api.purposeRequired",
    matchIdRequired: "api.matchIdRequired",
    purposeInvalid: "api.purposeInvalid",
    teamIdRequiredPenalty: "api.teamIdRequiredPenalty",
    skippedRoundsRequired: "api.skippedRoundsRequired",
    slotsArrayRequired: "api.slotsArrayRequired",
    groupIdRequired: "api.groupIdRequired",
    idRequired: "api.idRequired",
    teamNameRequired: "api.teamNameRequired",
    captainIdRequired: "api.captainIdRequired",
    noFieldsToUpdate: "api.noFieldsToUpdate",
    cannotDeleteTeamWithMatches: "api.cannotDeleteTeamWithMatches",
    playerIdRequired: "api.playerIdRequired",
    playerNotClubMember: "api.playerNotClubMember",
    imagePathRequired: "api.imagePathRequired",
    proposedDatetimeRequired: "api.proposedDatetimeRequired",
    postponeActionRequired: "api.postponeActionRequired",
    homeAwayNotAvailable: "api.homeAwayNotAvailable",
    requestingTeamIdRequired: "api.requestingTeamIdRequired",
    teamWarningFieldsRequired: "api.teamWarningFieldsRequired",
    teamNotActiveSeason: "api.teamNotActiveSeason",
    conventionUpdateRequired: "api.conventionUpdateRequired",
    nameRequired: "api.nameRequired",
    regionIdRequired: "api.regionIdRequired",
    invalidRegion: "api.invalidRegion",
    leagueNameMustBe: "api.leagueNameMustBe",
    invalidType: "api.invalidType",
    invalidRegionCode: "api.invalidRegionCode",
    invalidPatch: "api.invalidPatch",
    cannotDeleteGroupWithMatches: "api.cannotDeleteGroupWithMatches",
    invalidDelete: "api.invalidDelete",
    awardByeSecretNotConfigured: "api.awardByeSecretNotConfigured",
    supabaseNotConfigured: "api.supabaseNotConfigured",
    playerIdRequiredNoCreate: "api.playerIdRequiredNoCreate",
    teamAndPlayersRequired: "api.teamAndPlayersRequired",
    teamIdHomeOrAway: "api.teamIdHomeOrAway",
    teamIdQueryRequired: "api.teamIdQueryRequired",
    invalidScope: "api.invalidScope",
    exactly14Rounds: "api.exactly14Rounds",
    exactlyMatchDays: "api.exactlyMatchDays",
    invalidMatchDays: "api.invalidMatchDays",
    cannotAddTeam: "api.cannotAddTeam",
    nationalTeamsLimit: "api.nationalTeamsLimit",
    uploadFailed: "api.uploadFailed",
    penaltyFieldsRequired: "api.penaltyFieldsRequired",
    captainNotClubMember: "api.captainNotClubMember",
    captainAlreadyOnAnotherTeam: "api.captainAlreadyOnAnotherTeam",
    cannotRemoveCaptain: "api.cannotRemoveCaptain",
    invalidRequestBody: "api.invalidRequestBody",
    clubIdRequired: "api.clubIdRequired",
    captainIdInvalid: "api.captainIdInvalid",
    seasonSetupLocked: "api.seasonSetupLocked",
  },
  auth: {
    unauthorized: "auth.unauthorized",
    forbidden: "auth.forbidden",
    matchNotFound: "auth.matchNotFound",
    matchTeamsNotFound: "auth.matchTeamsNotFound",
    cannotAccessMatch: "auth.cannotAccessMatch",
    cannotEditLineupAfterPlayed: "auth.cannotEditLineupAfterPlayed",
    cannotEditLineup: "auth.cannotEditLineup",
    matchAlreadyScored: "auth.matchAlreadyScored",
    cannotSubmitScore: "auth.cannotSubmitScore",
    onlyArbiterOrManagerEditScore: "auth.onlyArbiterOrManagerEditScore",
    notAssignedClub: "auth.notAssignedClub",
    cannotManageConventionCards: "auth.cannotManageConventionCards",
  },
  scheduleSlots: {
    onlySevenOrEight: "scheduleSlots.onlySevenOrEight",
    byeCannotHaveTeam: "scheduleSlots.byeCannotHaveTeam",
    teamNotInGroup: "scheduleSlots.teamNotInGroup",
    teamOneSlot: "scheduleSlots.teamOneSlot",
    onlyOneBye: "scheduleSlots.onlyOneBye",
    eightTeamsNoBye: "scheduleSlots.eightTeamsNoBye",
    sevenTeamsOneBye: "scheduleSlots.sevenTeamsOneBye",
    sevenTeamsAllAssigned: "scheduleSlots.sevenTeamsAllAssigned",
    eightTeamsAllAssigned: "scheduleSlots.eightTeamsAllAssigned",
    cannotChangeAfterFixtures: "scheduleSlots.cannotChangeAfterFixtures",
  },
  files: {
    empty: "files.empty",
    tooLarge: "files.tooLarge",
    invalidType: "files.invalidType",
    unsupportedType: "files.unsupportedType",
  },
  nationalMatchDays: {
    expectedDays: "nationalMatchDays.expectedDays",
    missingDate: "nationalMatchDays.missingDate",
  },
  internal: {
    serverError: "internal.serverError",
  },
} as const;

type ValueOf<T> = T[keyof T];
type DeepValueOf<T> = T extends string
  ? T
  : T extends object
    ? ValueOf<{ [K in keyof T]: DeepValueOf<T[K]> }>
    : never;

export type ErrorCode = DeepValueOf<typeof ErrorCodes>;

export function isErrorCode(value: string): value is ErrorCode {
  const codes: string[] = [];
  function collect(obj: Record<string, unknown>) {
    for (const v of Object.values(obj)) {
      if (typeof v === "string") codes.push(v);
      else if (v && typeof v === "object") collect(v as Record<string, unknown>);
    }
  }
  collect(ErrorCodes as unknown as Record<string, unknown>);
  return codes.includes(value);
}

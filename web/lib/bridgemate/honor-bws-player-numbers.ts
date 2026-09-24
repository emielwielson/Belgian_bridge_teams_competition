/**
 * Map Honor locked seats to Bridgemate PlayerNumbers pre-registration rows.
 */

import type { BwsPlayerNumberRow, BwsSettingsRow } from "@/lib/bridgemate/bws-session";
import { formatPersonName } from "@/lib/butler/person-name";
import type { HonorDirection, HonorRoom } from "@/lib/competition/honor-lineup";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";

const SECTION_ID = 1;
const MAX_NAME_LEN = 18;
const DIRECTIONS: HonorDirection[] = ["N", "S", "E", "W"];

export function bridgematePlayerName(raw: string): string {
  const formatted = formatPersonName(raw.trim());
  return formatted.length > MAX_NAME_LEN
    ? formatted.slice(0, MAX_NAME_LEN)
    : formatted;
}

function seatName(
  match: HonorRoundMatchSeating,
  room: HonorRoom,
  direction: HonorDirection,
): string | null {
  const seat = match.seats.find(
    (s) => s.room === room && s.direction === direction,
  );
  if (!seat?.name?.trim()) return null;
  return bridgematePlayerName(seat.name);
}

function rowsForTable(
  match: HonorRoundMatchSeating,
  table: number,
  room: HonorRoom,
): BwsPlayerNumberRow[] {
  const rows: BwsPlayerNumberRow[] = [];
  for (const direction of DIRECTIONS) {
    const name = seatName(match, room, direction);
    if (!name) continue;
    rows.push({
      section: SECTION_ID,
      table,
      direction,
      number: null,
      name,
      updated: true,
      processed: false,
      round: 0,
    });
  }
  return rows;
}

/**
 * One PlayerNumbers row per seated direction at open/closed venue tables.
 * Open: home N/S + away E/W; closed: away N/S + home E/W (same as seat rooms).
 */
export function playerNumbersFromHonorMatches(
  matches: HonorRoundMatchSeating[],
): BwsPlayerNumberRow[] {
  const sorted = [...matches].sort((a, b) => {
    const ao = a.venue_tables?.openTable ?? 99;
    const bo = b.venue_tables?.openTable ?? 99;
    return ao - bo;
  });

  const rows: BwsPlayerNumberRow[] = [];
  for (const match of sorted) {
    const venue = match.venue_tables;
    if (!venue) continue;
    rows.push(...rowsForTable(match, venue.openTable, "open"));
    rows.push(...rowsForTable(match, venue.closedTable, "closed"));
  }
  return rows;
}

/** BCS Settings enabling pre-registered names without member-number entry. */
export function honorBwsNameSettings(): BwsSettingsRow {
  return {
    Section: SECTION_ID,
    ShowResults: true,
    ShowOwnResult: true,
    RepeatResults: false,
    MaximumResults: 0,
    ShowPercentage: true,
    GroupSections: false,
    ScorePoints: 1,
    EnterResultsMethod: 0,
    ShowPairNumbers: true,
    IntermediateResults: false,
    AutopoweroffTime: 20,
    VerificationTime: 2,
    ShowContract: 1,
    LeadCard: true,
    MemberNumbers: false,
    MemberNumbersNoBlankEntry: false,
    BoardOrderVerification: true,
    HandRecordValidation: true,
    AutoShutDownBPC: false,
    BM2PINcode: "0000",
    BM2ConfirmNP: false,
    BM2TDCall: false,
    BM2RemainingBoards: true,
    BM2NextSeatings: true,
    BM2ScoreRecap: false,
    BM2AutoShowScoreRecap: false,
    BM2ScoreCorrection: false,
    BM2AutoBoardNumber: true,
    BM2FirstBoardManually: false,
    BM2ValidateLeadCard: true,
    BM2ResultsOverview: 0,
    BM2ShowPlayerNames: 1,
    BM2Ranking: 0,
    BM2GameSummary: false,
    BM2SummaryPoints: 0,
    BM2PairNumberEntry: 0,
    BM2ResetFunctionKey: true,
    BM2RecordBidding: false,
    BM2RecordPlay: false,
    BM2ValidateRecording: false,
    BM2ShowHands: false,
    BM2NumberEntryEachRound: false,
    BM2NumberEntryPreloadValues: false,
    BM2NameSource: 2,
    BM2ViewHandRecord: false,
    BM2EnterHandRecord: false,
    BM2EnterHandRecordWhen: 0,
    BM2TextBasedNumber: false,
    BM2NumberValidation: 0,
    BM3ScreenBrightness: 6,
    BM3ScreenDimMode: 2,
    BM3ScreenOffMode: 2,
    BM3SleepMode: 120,
    BM3AudioVolume: 2,
    BM3Language: 0,
    BM3ConnectionMode: 0,
    BM3PINcode: "0000",
    BM3ConfirmNP: false,
    BM3TDCall: true,
    BM3ResultMethod: 0,
    BM3BoardResultReentry: true,
    BM3LeadCardEntry: 1,
    BM3PlayerView: 0,
    BM3PlayerNumberEntry: 0,
    BM3PlayerNumberEntryDuringPlay: false,
    BM3StartingPositions: 0,
    BM3Ranking: 1,
    BM3NextSeatings: true,
    BM3ScoreRecap: 2,
    BM3ScoreColumn: 0,
    BM3ViewResults: 2,
    BM3ViewPercentages: true,
    BM3ViewHandrecord: false,
    BM3EnterHandrecord: 0,
  };
}

import { formatPersonName } from "@/lib/butler/person-name";

/** Direction-agnostic player pair key (lexicographic min/max). */

export type CanonicalPlayerIds = {
  playerLowId: string;
  playerHighId: string;
};

export function canonicalPlayerIds(
  player1Id: string,
  player2Id: string,
): CanonicalPlayerIds {
  if (player1Id === player2Id) {
    throw new Error("Een paar moet uit twee verschillende spelers bestaan.");
  }
  return player1Id < player2Id
    ? { playerLowId: player1Id, playerHighId: player2Id }
    : { playerLowId: player2Id, playerHighId: player1Id };
}

export function combinationDisplayName(
  player1Name: string,
  player2Name: string,
  player1Id: string,
  player2Id: string,
): string {
  const { playerLowId } = canonicalPlayerIds(player1Id, player2Id);
  const lowName = player1Id === playerLowId ? player1Name : player2Name;
  const highName = player1Id === playerLowId ? player2Name : player1Name;
  return `${formatPersonName(lowName)} · ${formatPersonName(highName)}`;
}

export type CombinationUpsertRow = {
  id: string;
  group_id: string;
  team_id: string;
  player_low_id: string;
  player_high_id: string;
  display_name: string;
};

export type UpsertCombinationInput = {
  groupId: string;
  teamId: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
};

/** Build insert payload for honor_player_combinations (caller does DB upsert). */
export function buildCombinationUpsert(
  input: UpsertCombinationInput,
): Omit<CombinationUpsertRow, "id"> {
  const { playerLowId, playerHighId } = canonicalPlayerIds(
    input.player1Id,
    input.player2Id,
  );
  return {
    group_id: input.groupId,
    team_id: input.teamId,
    player_low_id: playerLowId,
    player_high_id: playerHighId,
    display_name: combinationDisplayName(
      input.player1Name,
      input.player2Name,
      input.player1Id,
      input.player2Id,
    ),
  };
}

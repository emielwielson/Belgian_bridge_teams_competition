export type ManualStepDef = {
  id: string;
  /** Filename under /manuals/ (e.g. player-01-find-match.png). Omit until screenshot exists. */
  image?: string;
};

export type ManualGuideDef = {
  id: string;
  anchor: string;
  /** Key under manuals.* (e.g. player.enterScore) */
  translationKey: string;
  steps: ManualStepDef[];
};

export const PLAYER_GUIDES: ManualGuideDef[] = [
  {
    id: "enter-score",
    anchor: "enter-score",
    translationKey: "player.enterScore",
    steps: [
      { id: "find-match", image: "player-01-find-match.png" },
      { id: "match-page", image: "player-02-match-page.png" },
      { id: "home-lineup", image: "player-03-home-lineup.png" },
      { id: "away-lineup", image: "player-04-away-lineup.png" },
      { id: "score-form", image: "player-05-score-form.png" },
      { id: "score-submitted", image: "player-06-score-submitted.png" },
    ],
  },
];

export const CAPTAIN_GUIDES: ManualGuideDef[] = [
  {
    id: "add-members",
    anchor: "add-team-members",
    translationKey: "captain.addMembers",
    steps: [
      { id: "team-page", image: "captain-roster-01-team-page.png" },
      { id: "add-player", image: "captain-roster-02-add-player.png" },
      { id: "roster-updated" },
      { id: "remove-player" },
    ],
  },
  {
    id: "postpone",
    anchor: "postpone-match",
    translationKey: "captain.postpone",
    steps: [
      { id: "open-reschedule" },
      { id: "propose-date" },
      { id: "pending-approval" },
      { id: "approve-reject" },
      { id: "played-unavailable" },
    ],
  },
  {
    id: "home-away",
    anchor: "home-away-switch",
    translationKey: "captain.homeAway",
    steps: [
      { id: "open-swap" },
      { id: "propose-swap" },
      { id: "approve-swap" },
    ],
  },
];

export function manualImageSrc(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  return `/manuals/${filename}`;
}

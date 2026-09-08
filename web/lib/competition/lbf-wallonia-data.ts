/**
 * Wallonia LBF Superleague 2026–27: structure and fixtures from Calendrier LBF 26-27.xlsx.
 * One division (Superleague = Liga 1 level) with groups SLA / SLB / SLC.
 */

export const WALLONIA_SUPERLEAGUE_DIVISION = "Superleague" as const;

export const WALLONIA_SUPERLEAGUE_GROUPS = ["SLA", "SLB", "SLC"] as const;

export type WalloniaSuperleagueGroupCode =
  (typeof WALLONIA_SUPERLEAGUE_GROUPS)[number];

export type WalloniaFixtureRow = {
  round: number;
  home: string;
  away: string;
};

export type WalloniaGroupSpec = {
  groupCode: WalloniaSuperleagueGroupCode;
  teams: string[];
  fixtures: WalloniaFixtureRow[];
  roundRobinCount: number;
  roundCount: number;
};

/** Team label → federation club_number (shared DB / Ledenbeheer). */
export const WALLONIA_TEAM_CLUB_NUMBERS: Record<string, string> = {
  "Espace Pontia 1": "202039",
  "Espace Pontia 2": "202039",
  "CLP 11": "202041",
  "CLP 12": "202041",
  "CLP 13": "202041",
  "Namur 5": "203012",
  "Namur 6": "203012",
  "Hornu 1": "203032",
  "Loverval 1": "203034",
  "CBMS 1": "203036",
  "CBMS 2": "203036",
  "UMA 1": "202016",
  "BBC 8": "201014",
  "BBC 9": "201014",
  "Mons 1": "203010",
  "Mons 2": "203010",
  "Charleroi 3": "203004",
};

export type WalloniaRoundSlot = {
  round: number;
  date: string;
  time: string;
};

const WALLONIA_MATCH_DAYS = [
  "2026-10-03",
  "2026-10-10",
  "2026-10-17",
  "2026-11-14",
  "2026-11-21",
  "2026-11-28",
  "2026-12-12",
  "2027-01-16",
  "2027-01-23",
  "2027-02-06",
] as const;

export const WALLONIA_10_ROUNDS: WalloniaRoundSlot[] = WALLONIA_MATCH_DAYS.map(
  (date, index) => ({
    round: index + 1,
    date,
    time: "14:00",
  }),
);

export function walloniaSlotToBrusselsLocal({
  date,
  time,
}: WalloniaRoundSlot): string {
  return `${date}T${time}`;
}

export const WALLONIA_SUPERLEAGUE_SPECS: WalloniaGroupSpec[] = [
  {
    groupCode: "SLA",
    roundRobinCount: 2,
    roundCount: 10,
    teams: ["UMA 1", "CLP 13", "BBC 9", "Mons 1", "Charleroi 3"],
    fixtures: [
      { round: 1, home: "Charleroi 3", away: "Mons 1" },
      { round: 1, home: "CLP 13", away: "UMA 1" },
      { round: 1, home: "BBC 9", away: "Bye" },
      { round: 2, home: "UMA 1", away: "Charleroi 3" },
      { round: 2, home: "Mons 1", away: "BBC 9" },
      { round: 2, home: "Bye", away: "CLP 13" },
      { round: 3, home: "Charleroi 3", away: "BBC 9" },
      { round: 3, home: "UMA 1", away: "Bye" },
      { round: 3, home: "CLP 13", away: "Mons 1" },
      { round: 4, home: "Bye", away: "Charleroi 3" },
      { round: 4, home: "BBC 9", away: "CLP 13" },
      { round: 4, home: "UMA 1", away: "Mons 1" },
      { round: 5, home: "CLP 13", away: "Charleroi 3" },
      { round: 5, home: "Bye", away: "Mons 1" },
      { round: 5, home: "BBC 9", away: "UMA 1" },
      { round: 6, home: "Mons 1", away: "Charleroi 3" },
      { round: 6, home: "UMA 1", away: "CLP 13" },
      { round: 6, home: "Bye", away: "BBC 9" },
      { round: 7, home: "Charleroi 3", away: "UMA 1" },
      { round: 7, home: "BBC 9", away: "Mons 1" },
      { round: 7, home: "CLP 13", away: "Bye" },
      { round: 8, home: "BBC 9", away: "Charleroi 3" },
      { round: 8, home: "Bye", away: "UMA 1" },
      { round: 8, home: "Mons 1", away: "CLP 13" },
      { round: 9, home: "Charleroi 3", away: "Bye" },
      { round: 9, home: "CLP 13", away: "BBC 9" },
      { round: 9, home: "Mons 1", away: "UMA 1" },
      { round: 10, home: "Charleroi 3", away: "CLP 13" },
      { round: 10, home: "Mons 1", away: "Bye" },
      { round: 10, home: "UMA 1", away: "BBC 9" },
    ],
  },
  {
    groupCode: "SLB",
    roundRobinCount: 2,
    roundCount: 10,
    teams: [
      "Espace Pontia 1",
      "CLP 11",
      "Namur 6",
      "Hornu 1",
      "Loverval 1",
      "CBMS 2",
    ],
    fixtures: [
      { round: 1, home: "CBMS 2", away: "Hornu 1" },
      { round: 1, home: "CLP 11", away: "Espace Pontia 1" },
      { round: 1, home: "Namur 6", away: "Loverval 1" },
      { round: 2, home: "Espace Pontia 1", away: "CBMS 2" },
      { round: 2, home: "Hornu 1", away: "Namur 6" },
      { round: 2, home: "Loverval 1", away: "CLP 11" },
      { round: 3, home: "CBMS 2", away: "Namur 6" },
      { round: 3, home: "Espace Pontia 1", away: "Loverval 1" },
      { round: 3, home: "CLP 11", away: "Hornu 1" },
      { round: 4, home: "Loverval 1", away: "CBMS 2" },
      { round: 4, home: "Namur 6", away: "CLP 11" },
      { round: 4, home: "Espace Pontia 1", away: "Hornu 1" },
      { round: 5, home: "CLP 11", away: "CBMS 2" },
      { round: 5, home: "Loverval 1", away: "Hornu 1" },
      { round: 5, home: "Namur 6", away: "Espace Pontia 1" },
      { round: 6, home: "Hornu 1", away: "CBMS 2" },
      { round: 6, home: "Espace Pontia 1", away: "CLP 11" },
      { round: 6, home: "Loverval 1", away: "Namur 6" },
      { round: 7, home: "CBMS 2", away: "Espace Pontia 1" },
      { round: 7, home: "Namur 6", away: "Hornu 1" },
      { round: 7, home: "CLP 11", away: "Loverval 1" },
      { round: 8, home: "Namur 6", away: "CBMS 2" },
      { round: 8, home: "Loverval 1", away: "Espace Pontia 1" },
      { round: 8, home: "Hornu 1", away: "CLP 11" },
      { round: 9, home: "CBMS 2", away: "Loverval 1" },
      { round: 9, home: "CLP 11", away: "Namur 6" },
      { round: 9, home: "Hornu 1", away: "Espace Pontia 1" },
      { round: 10, home: "CBMS 2", away: "CLP 11" },
      { round: 10, home: "Hornu 1", away: "Loverval 1" },
      { round: 10, home: "Espace Pontia 1", away: "Namur 6" },
    ],
  },
  {
    groupCode: "SLC",
    roundRobinCount: 2,
    roundCount: 10,
    teams: [
      "Espace Pontia 2",
      "CLP 12",
      "Namur 5",
      "Mons 2",
      "BBC 8",
      "CBMS 1",
    ],
    fixtures: [
      { round: 1, home: "Namur 5", away: "Mons 2" },
      { round: 1, home: "CLP 12", away: "Espace Pontia 2" },
      { round: 1, home: "BBC 8", away: "CBMS 1" },
      { round: 2, home: "Espace Pontia 2", away: "Namur 5" },
      { round: 2, home: "Mons 2", away: "BBC 8" },
      { round: 2, home: "CBMS 1", away: "CLP 12" },
      { round: 3, home: "Namur 5", away: "BBC 8" },
      { round: 3, home: "Espace Pontia 2", away: "CBMS 1" },
      { round: 3, home: "CLP 12", away: "Mons 2" },
      { round: 4, home: "CBMS 1", away: "Namur 5" },
      { round: 4, home: "BBC 8", away: "CLP 12" },
      { round: 4, home: "Espace Pontia 2", away: "Mons 2" },
      { round: 5, home: "CLP 12", away: "Namur 5" },
      { round: 5, home: "CBMS 1", away: "Mons 2" },
      { round: 5, home: "BBC 8", away: "Espace Pontia 2" },
      { round: 6, home: "Mons 2", away: "Namur 5" },
      { round: 6, home: "Espace Pontia 2", away: "CLP 12" },
      { round: 6, home: "CBMS 1", away: "BBC 8" },
      { round: 7, home: "Namur 5", away: "Espace Pontia 2" },
      { round: 7, home: "BBC 8", away: "Mons 2" },
      { round: 7, home: "CLP 12", away: "CBMS 1" },
      { round: 8, home: "BBC 8", away: "Namur 5" },
      { round: 8, home: "CBMS 1", away: "Espace Pontia 2" },
      { round: 8, home: "Mons 2", away: "CLP 12" },
      { round: 9, home: "Namur 5", away: "CBMS 1" },
      { round: 9, home: "CLP 12", away: "BBC 8" },
      { round: 9, home: "Mons 2", away: "Espace Pontia 2" },
      { round: 10, home: "Namur 5", away: "CLP 12" },
      { round: 10, home: "Mons 2", away: "CBMS 1" },
      { round: 10, home: "Espace Pontia 2", away: "BBC 8" },
    ],
  },
];

export function isByeLabel(name: string): boolean {
  return name.trim().toLowerCase() === "bye";
}

export function walloniaGroupLabel(groupCode: string): string {
  return `${WALLONIA_SUPERLEAGUE_DIVISION} ${groupCode}`;
}

export function uniqueWalloniaClubNumbers(): string[] {
  return [...new Set(Object.values(WALLONIA_TEAM_CLUB_NUMBERS))].sort();
}

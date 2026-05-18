/**
 * Flanders 2024–25 regional demo: divisions, groups, and team names from last season.
 */

export type FlandersDemoGroupSpec = {
  liga: 1 | 2 | 3;
  groupCode: string;
  teams: string[];
  /** Full round-robin cycles (total rounds = roundsPerCycle(teams) × roundRobinCount). */
  roundRobinCount: number;
};

export const FLANDERS_DEMO_GROUPS: FlandersDemoGroupSpec[] = [
  {
    liga: 1,
    groupCode: "A",
    roundRobinCount: 2,
    teams: [
      "Waregem 4",
      "Molenland 1",
      "Sandeman 4",
      "Eeklo 2",
      "Chaver 1",
      "Feniks 1",
      "Waregem 3",
      "Leieland 1",
    ],
  },
  {
    liga: 1,
    groupCode: "B",
    roundRobinCount: 2,
    teams: [
      "Heusden 1",
      "Sandeman 3",
      "Waregem 2",
      "Beveren 1",
      "Athena 1",
      "Sandeman 5",
      "Edegem 1",
      "Dulcinea 1",
    ],
  },
  {
    liga: 1,
    groupCode: "C",
    roundRobinCount: 2,
    teams: [
      "Kwadraat 1",
      "Haacht 1",
      "Riviera 9",
      "Lier 3",
      "Beerschot 1",
      "Boeckenberg 2",
      "Zennebridge 2",
      "Pieterman 5",
    ],
  },
  {
    liga: 1,
    groupCode: "D",
    roundRobinCount: 2,
    teams: [
      "DUA 2",
      "De Teuten 1",
      "Pieterman 6",
      "Riviera 10",
      "Kastelse 1",
      "Boeckenberg 3",
      "Riviera 8",
      "Retiese 2",
    ],
  },
  {
    liga: 2,
    groupCode: "A",
    roundRobinCount: 2,
    teams: [
      "Veurne C1",
      "Leieland 2",
      "Dulcinea 2",
      "Roeselare 2",
      "Roeselare 3",
      "Veurne C2",
      "Waregem 5",
      "Athena 3",
    ],
  },
  {
    liga: 2,
    groupCode: "B",
    roundRobinCount: 2,
    teams: [
      "Knokke 2",
      "Waregem 6",
      "Saint Georges 1",
      "Leieland 3",
      "Witte Beer 3",
      "Molenland 2",
      "Athena 2",
    ],
  },
  {
    liga: 2,
    groupCode: "C",
    roundRobinCount: 2,
    teams: [
      "Lokeren 1",
      "Klein Brabant 1",
      "Sandeman 6",
      "Westrand 3",
      "Molenland 3",
      "Sandeman 9",
      "Sandeman 7",
      "Eeklo 3",
    ],
  },
  {
    liga: 2,
    groupCode: "D",
    roundRobinCount: 2,
    teams: [
      "Wilg&Donk 2",
      "Sandeman 11",
      "Klein Brabant 2",
      "Brasschaatse 2",
      "Riviera 11",
      "Kollebloem 1",
      "Athena 4",
      "Sandeman 8",
    ],
  },
  {
    liga: 2,
    groupCode: "E",
    roundRobinCount: 2,
    teams: [
      "Waasmunster 2",
      "Brasschaatse 1",
      "Wilg&Donk 3",
      "Edegem 2",
      "Riviera 12",
      "Boeckenberg 4",
      "Riviera 13",
      "DUA 3",
    ],
  },
  {
    liga: 2,
    groupCode: "F",
    roundRobinCount: 2,
    teams: [
      "Essense 1",
      "Retiese 3",
      "Oostmalle 1",
      "Goldstar 1",
      "Kastelse 2",
      "Brechtse 1",
      "Essense 2",
    ],
  },
  {
    liga: 2,
    groupCode: "G",
    roundRobinCount: 2,
    teams: [
      "Pieterman 8",
      "Bree 2",
      "Haspengouw 1",
      "Haacht 2",
      "Leopoldsburg 1C",
      "Bree 1",
      "Pieterman 7",
    ],
  },
  {
    liga: 3,
    groupCode: "A",
    roundRobinCount: 4,
    teams: ["Heusden 2", "Dulcinea 3", "Veurne 3C", "Sandeman 10"],
  },
  {
    liga: 3,
    groupCode: "B",
    roundRobinCount: 2,
    teams: [
      "Kwatdraat 2",
      "Klein Brabant 3",
      "Edegem 3",
      "Riviera 14",
      "Essense 3",
      "Brasschaatse 3",
      "Riviera 16",
      "Riviera 15",
    ],
  },
];

export const FLANDERS_DIVISIONS = [
  { name: "Liga 1", divisionLevelCode: "first" as const },
  { name: "Liga 2", divisionLevelCode: "second" as const },
  { name: "Liga 3", divisionLevelCode: "third" as const },
];

export function flandersDivisionName(liga: 1 | 2 | 3): string {
  return `Liga ${liga}`;
}

export function flandersGroupLabel(spec: FlandersDemoGroupSpec): string {
  return `Liga ${spec.liga} ${spec.groupCode}`;
}

/** Club name from team label (e.g. "Waregem 4" → "Waregem", "Veurne C1" → "Veurne"). */
export function clubNameFromTeamName(teamName: string): string {
  const trimmed = teamName.trim();
  const match = trimmed.match(/^(.*)\s+(?:\d+|C\d+|1C)$/);
  return match ? match[1].trim() : trimmed;
}

export function uniqueFlandersClubNames(): string[] {
  const names = new Set<string>();
  for (const group of FLANDERS_DEMO_GROUPS) {
    for (const team of group.teams) {
      names.add(clubNameFromTeamName(team));
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

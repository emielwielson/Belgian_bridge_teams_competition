/**
 * National 2024–25 demo: division teams from last season (VP totals omitted).
 */

export type NationalDemoDivisionSpec = {
  divisionName: string;
  teams: string[];
};

export const NATIONAL_DEMO_DIVISIONS: NationalDemoDivisionSpec[] = [
  {
    divisionName: "Honor Division",
    teams: [
      "Riviera 121",
      "BBC 321",
      "BBC 121",
      "BBC 221",
      "UAE 121",
      "BBC 421",
      "Cercle-Perron 121",
      "Pieterman 121",
    ],
  },
  {
    divisionName: "1st Division",
    teams: [
      "Riviera 214",
      "Sandeman 114",
      "Riviera 314",
      "Cercle-Perron 214",
      "Squeeze 114",
      "BBC 514",
      "UAE 214",
      "Genk 114",
    ],
  },
  {
    divisionName: "2nd Division A",
    teams: [
      "Pieterman 214",
      "Cercle-Perron 314",
      "Waregem 114",
      "Charleroi 114",
      "Riviera 414",
      "Forum 114",
      "Squeeze 214",
      "Westrand 114",
    ],
  },
  {
    divisionName: "2nd Division B",
    teams: [
      "Boeckenberg 114",
      "Cercle-Perron 414",
      "Cercle-Perron 514",
      "Lier 114",
      "DUA 114",
      "Geel 114",
      "Riviera 514",
      "Verviers 114",
    ],
  },
  {
    divisionName: "3rd Division A",
    teams: [
      "Knokke 114",
      "Witte Beer 214",
      "Forum 214",
      "Waasmunster 114",
      "Witte Beer 114",
      "Bridgeclub Roeselare 114",
      "Eeklo 114",
      "Westrand 214",
    ],
  },
  {
    divisionName: "3rd Division B",
    teams: [
      "Argayon 114",
      "Sandeman 214",
      "Pieterman 314",
      "Namur 214",
      "UAE 314",
      "Wilg & Donk 114",
      "Riviera 614",
      "BBC 814",
    ],
  },
  {
    divisionName: "3rd Division C",
    teams: [
      "Namur 114",
      "BBC 614",
      "Cercle-Perron 614",
      "Charleroi 214",
      "Cercle-Perron 714",
      "B.C. Mons 114",
      "Smohain 114",
      "BBC 914",
    ],
  },
  {
    divisionName: "3rd Division D",
    teams: [
      "BBC 714",
      "Lier 214",
      "Pieterman 414",
      "Cercle-Perron 814",
      "Zennebridge 114",
      "Aarschot 114",
      "Retiese 114",
      "Riviera 714",
    ],
  },
];

/** Club name from team label (e.g. "Riviera 121" → "Riviera"). */
export function nationalClubNameFromTeamName(teamName: string): string {
  const trimmed = teamName.trim();
  const match = trimmed.match(/^(.*)\s+\d{3}$/);
  return match ? match[1].trim() : trimmed;
}

export function uniqueNationalClubNames(): string[] {
  const names = new Set<string>();
  for (const division of NATIONAL_DEMO_DIVISIONS) {
    for (const team of division.teams) {
      names.add(nationalClubNameFromTeamName(team));
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

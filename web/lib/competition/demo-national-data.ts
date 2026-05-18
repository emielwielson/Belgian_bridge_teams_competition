/**
 * National 2024–25 demo: division teams from last season (VP totals omitted).
 *
 * Source labels concatenated team index with division round count (e.g. "BBC 121"
 * = BBC team 1 in Honor with 21 rounds). Demo names use club + team index only.
 */

import { NATIONAL_DIVISIONS } from "./national-structure";

export type NationalDemoDivisionSpec = {
  divisionName: string;
  teams: string[];
};

/** Labels as imported (team index + round_count suffix). */
const RAW_NATIONAL_DEMO_TEAMS: Record<string, string[]> = {
  "Honor Division": [
    "Riviera 121",
    "BBC 321",
    "BBC 121",
    "BBC 221",
    "UAE 121",
    "BBC 421",
    "Cercle-Perron 121",
    "Pieterman 121",
  ],
  "1st Division": [
    "Riviera 214",
    "Sandeman 114",
    "Riviera 314",
    "Cercle-Perron 214",
    "Squeeze 114",
    "BBC 514",
    "UAE 214",
    "Genk 114",
  ],
  "2nd Division A": [
    "Pieterman 214",
    "Cercle-Perron 314",
    "Waregem 114",
    "Charleroi 114",
    "Riviera 414",
    "Forum 114",
    "Squeeze 214",
    "Westrand 114",
  ],
  "2nd Division B": [
    "Boeckenberg 114",
    "Cercle-Perron 414",
    "Cercle-Perron 514",
    "Lier 114",
    "DUA 114",
    "Geel 114",
    "Riviera 514",
    "Verviers 114",
  ],
  "3rd Division A": [
    "Knokke 114",
    "Witte Beer 214",
    "Forum 214",
    "Waasmunster 114",
    "Witte Beer 114",
    "Bridgeclub Roeselare 114",
    "Eeklo 114",
    "Westrand 214",
  ],
  "3rd Division B": [
    "Argayon 114",
    "Sandeman 214",
    "Pieterman 314",
    "Namur 214",
    "UAE 314",
    "Wilg & Donk 114",
    "Riviera 614",
    "BBC 814",
  ],
  "3rd Division C": [
    "Namur 114",
    "BBC 614",
    "Cercle-Perron 614",
    "Charleroi 214",
    "Cercle-Perron 714",
    "B.C. Mons 114",
    "Smohain 114",
    "BBC 914",
  ],
  "3rd Division D": [
    "BBC 714",
    "Lier 214",
    "Pieterman 414",
    "Cercle-Perron 814",
    "Zennebridge 114",
    "Aarschot 114",
    "Retiese 114",
    "Riviera 714",
  ],
};

/** Strip trailing round_count from imported team labels (121 → 1 when round_count is 21). */
export function normalizeNationalDemoTeamName(
  rawTeamName: string,
  roundCount: number,
): string {
  const match = rawTeamName.trim().match(/^(.*)\s+(\d+)$/);
  if (!match) return rawTeamName.trim();
  const [, club, digits] = match;
  const suffix = String(roundCount);
  if (digits.endsWith(suffix)) {
    const teamNum = digits.slice(0, -suffix.length);
    if (teamNum.length > 0) {
      return `${club.trim()} ${teamNum}`;
    }
  }
  return rawTeamName.trim();
}

export const NATIONAL_DEMO_DIVISIONS: NationalDemoDivisionSpec[] =
  NATIONAL_DIVISIONS.map((division) => {
    const rawTeams = RAW_NATIONAL_DEMO_TEAMS[division.name] ?? [];
    return {
      divisionName: division.name,
      teams: rawTeams.map((name) =>
        normalizeNationalDemoTeamName(name, division.roundCount),
      ),
    };
  });

/** Club name from team label (e.g. "BBC 1" → "BBC"). */
export function nationalClubNameFromTeamName(teamName: string): string {
  const trimmed = teamName.trim();
  const match = trimmed.match(/^(.*)\s+\d+$/);
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

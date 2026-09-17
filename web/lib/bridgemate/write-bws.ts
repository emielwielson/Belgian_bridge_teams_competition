import * as fs from "fs";
import * as path from "path";
import type { BwsSessionPlan } from "@/lib/bridgemate/bws-session";
import { insertRows } from "@/lib/bridgemate/jet4-insert";

const TEMPLATE_RELATIVE = "fixtures/bridgemate/Template_Access2000_v5.bws";

export function bwsTemplatePath(): string {
  return path.join(process.cwd(), TEMPLATE_RELATIVE);
}

export function loadBwsTemplate(): Buffer {
  const filePath = bwsTemplatePath();
  try {
    return fs.readFileSync(filePath);
  } catch {
    throw new Error(
      "Bridgemate-sjabloon ontbreekt. Verwacht fixtures/bridgemate/Template_Access2000_v5.bws.",
    );
  }
}

/** Write Session/Section/Tables/RoundData into a copy of the official template. */
export function writeBwsFromPlan(
  plan: BwsSessionPlan,
  template: Buffer = loadBwsTemplate(),
  now: Date = new Date(),
): Buffer {
  let buffer: Buffer = Buffer.from(template);

  buffer = Buffer.from(
    insertRows(
      buffer,
      "Session",
      [
        {
          ID: plan.session.id,
          Name: plan.session.name,
          Date: now,
          Time: now,
          GUID: plan.session.guid,
          Status: plan.session.status,
          ShowInApp: plan.session.showInApp,
          PairsMoveAcrossField: plan.session.pairsMoveAcrossField,
          EWReturnHome: plan.session.ewReturnHome,
        },
      ],
      now,
    ),
  );

  buffer = Buffer.from(
    insertRows(
      buffer,
      "Section",
      plan.sections.map((s) => ({
        ID: s.id,
        Letter: s.letter,
        Tables: s.tables,
        MissingPair: s.missingPair,
        EWMoveBeforePlay: s.ewMoveBeforePlay,
        Session: s.session,
        ScoringType: s.scoringType,
        Winners: s.winners,
      })),
      now,
    ),
  );

  buffer = Buffer.from(
    insertRows(
      buffer,
      "Tables",
      plan.tables.map((t) => ({
        Section: t.section,
        Table: t.table,
        ComputerID: t.computerId,
        Status: t.status,
        LogOnOff: t.logOnOff,
        CurrentRound: t.currentRound,
        CurrentBoard: t.currentBoard,
        UpdateFromRound: t.updateFromRound,
        Group: t.group,
      })),
      now,
    ),
  );

  buffer = Buffer.from(
    insertRows(
      buffer,
      "RoundData",
      plan.roundData.map((r) => ({
        Section: r.section,
        Table: r.table,
        Round: r.round,
        NSPair: r.nsPair,
        EWPair: r.ewPair,
        LowBoard: r.lowBoard,
        HighBoard: r.highBoard,
        CustomBoards: r.customBoards,
      })),
      now,
    ),
  );

  return buffer;
}

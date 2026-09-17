import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { buildBwsSession } from "./bws-session";
import { writeBwsFromPlan } from "./write-bws";

function honorPlan() {
  const built = buildBwsSession(
    {
      tournamentRoundNumber: 3,
      matches: [
        {
          id: "m1",
          boardCount: 16,
          tables: [
            {
              id: "t1",
              bridgemateSection: "A",
              bridgemateTable: 1,
              nsPairId: "p11",
              ewPairId: "p81",
            },
            {
              id: "t2",
              bridgemateSection: "A",
              bridgemateTable: 2,
              nsPairId: "p82",
              ewPairId: "p12",
            },
          ],
        },
        {
          id: "m2",
          boardCount: 16,
          tables: [
            {
              id: "t3",
              bridgemateSection: "A",
              bridgemateTable: 3,
              nsPairId: "p21",
              ewPairId: "p71",
            },
            {
              id: "t4",
              bridgemateSection: "A",
              bridgemateTable: 4,
              nsPairId: "p72",
              ewPairId: "p22",
            },
          ],
        },
      ],
      pairs: [
        { id: "p11", bridgematePairNumber: 11 },
        { id: "p12", bridgematePairNumber: 12 },
        { id: "p21", bridgematePairNumber: 21 },
        { id: "p22", bridgematePairNumber: 22 },
        { id: "p71", bridgematePairNumber: 71 },
        { id: "p72", bridgematePairNumber: 72 },
        { id: "p81", bridgematePairNumber: 81 },
        { id: "p82", bridgematePairNumber: 82 },
      ],
    },
    { guid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
  );
  if (!built.ok) throw new Error(built.errors.join("; "));
  return built.plan;
}

/** Jest cannot import ESM mdb-reader; spawn Node to round-trip the buffer. */
function readBwsTables(buffer: Buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bws-"));
  const file = path.join(dir, "out.bws");
  fs.writeFileSync(file, buffer);
  const mdbEntry = path.join(
    process.cwd(),
    "node_modules/mdb-reader/lib/node/index.js",
  );
  const script = `
    import MDBReader from ${JSON.stringify(mdbEntry)};
    import fs from "fs";
    const r = new MDBReader(fs.readFileSync(${JSON.stringify(file)}));
    const dump = (n) => r.getTable(n).getData();
    const data = {
      session: dump("Session"),
      section: dump("Section"),
      tables: dump("Tables"),
      roundData: dump("RoundData"),
      received: dump("ReceivedData"),
    };
    console.log(JSON.stringify(data, (_, v) => (v instanceof Date ? v.toISOString() : v)));
  `;
  try {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8",
      cwd: process.cwd(),
    });
    return JSON.parse(out) as {
      session: Array<Record<string, unknown>>;
      section: Array<Record<string, unknown>>;
      tables: Array<Record<string, unknown>>;
      roundData: Array<Record<string, unknown>>;
      received: Array<Record<string, unknown>>;
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("writeBwsFromPlan", () => {
  it("inserts Session/Section/Tables/RoundData readable by mdb-reader", () => {
    const template = fs.readFileSync(
      path.join(process.cwd(), "fixtures/bridgemate/Template_Access2000_v5.bws"),
    );
    const plan = honorPlan();
    const buffer = writeBwsFromPlan(
      plan,
      template,
      new Date("2026-08-17T12:00:00Z"),
    );

    const { session, section, tables, roundData, received } = readBwsTables(buffer);

    expect(session).toHaveLength(1);
    expect(session[0].ID).toBe(1);
    expect(session[0].Name).toBe("Honneur ronde 3");
    expect(String(session[0].GUID)).toContain("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(session[0].Status).toBe(0);
    expect(session[0].EWReturnHome).toBe(false);

    expect(section).toEqual([
      expect.objectContaining({
        ID: 1,
        Letter: "A",
        Tables: 4,
        ScoringType: 4,
        Winners: 2,
        Session: 1,
      }),
    ]);

    expect(tables).toHaveLength(4);
    expect(tables.map((t) => [t.Table, t.Group])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
    ]);

    expect(roundData).toHaveLength(4);
    expect(roundData[0]).toEqual(
      expect.objectContaining({
        Section: 1,
        Table: 1,
        Round: 1,
        NSPair: 11,
        EWPair: 81,
        LowBoard: 1,
        HighBoard: 16,
      }),
    );
    expect(roundData[0].CustomBoards == null || roundData[0].CustomBoards === "").toBe(
      true,
    );

    expect(received).toHaveLength(0);
  });
});

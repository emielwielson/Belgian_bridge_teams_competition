import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  dedupeReceivedData,
  previousFieldsFromReceivedPayload,
  receivedDataGroupKey,
} from "@/lib/bridgemate/dedupe-received";
import { parseBwsBuffer } from "@/lib/bridgemate/parse-bws";
import type { ReceivedDataRow } from "@/lib/bridgemate/types";

/** Real BCS 3-row correction from honneur-ronde-1.bws (table 8 board 12). */
const ronde1Table8Board12: ReceivedDataRow[] = [
  {
    ID: 104,
    Section: 1,
    Table: 8,
    Round: 1,
    Board: 12,
    PairNS: 82,
    PairEW: 72,
    Contract: "3 NT",
    Result: "-1",
    Declarer: 72,
    "NS/EW": "W",
    Remarks: "",
    Erased: false,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T12:54:25.998Z",
    LeadCard: "H4",
  },
  {
    ID: 127,
    Section: 1,
    Table: 8,
    Round: 1,
    Board: 12,
    PairNS: 82,
    PairEW: 72,
    Contract: "3 NT",
    Result: "-1",
    Declarer: 72,
    "NS/EW": "W",
    Remarks: "Result erased",
    Erased: true,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T13:16:34.000Z",
    LeadCard: "H4",
  },
  {
    ID: 128,
    Section: 1,
    Table: 8,
    Round: 1,
    Board: 12,
    PairNS: 82,
    PairEW: 72,
    Contract: "3 NT",
    Result: "=",
    Declarer: 72,
    "NS/EW": "W",
    Remarks: "",
    Erased: false,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T13:16:54.002Z",
    LeadCard: "H4",
  },
];

/** Real BCS correction from honneur-ronde-2.bws (table 1 board 15: denom change). */
const ronde2Table1Board15: ReceivedDataRow[] = [
  {
    Section: 1,
    Table: 1,
    Round: 1,
    Board: 15,
    Contract: "3 C",
    Result: "+1",
    Declarer: 61,
    "NS/EW": "W",
    Remarks: "",
    Erased: false,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T15:55:03.996Z",
    LeadCard: "CK",
  },
  {
    Section: 1,
    Table: 1,
    Round: 1,
    Board: 15,
    Contract: "3 C",
    Result: "+1",
    Declarer: 61,
    "NS/EW": "W",
    Remarks: "Result erased",
    Erased: true,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T16:02:29.000Z",
    LeadCard: "CK",
  },
  {
    Section: 1,
    Table: 1,
    Round: 1,
    Board: 15,
    Contract: "3 H",
    Result: "+1",
    Declarer: 61,
    "NS/EW": "W",
    Remarks: "",
    Erased: false,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T16:02:49.001Z",
    LeadCard: "CK",
  },
];

/** Real BCS correction from honneur-ronde-3.bws (table 5 board 12). */
const ronde3Table5Board12: ReceivedDataRow[] = [
  {
    Section: 1,
    Table: 5,
    Round: 1,
    Board: 12,
    Contract: "4 H",
    Result: "-1",
    Declarer: 51,
    "NS/EW": "S",
    Remarks: "",
    Erased: false,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T18:10:25.000Z",
    LeadCard: "DJ",
  },
  {
    Section: 1,
    Table: 5,
    Round: 1,
    Board: 12,
    Contract: "4 H",
    Result: "-1",
    Declarer: 51,
    "NS/EW": "S",
    Remarks: "Result erased",
    Erased: true,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T18:20:46.000Z",
    LeadCard: "DJ",
  },
  {
    Section: 1,
    Table: 5,
    Round: 1,
    Board: 12,
    Contract: "4 S",
    Result: "-2",
    Declarer: 51,
    "NS/EW": "S",
    Remarks: "",
    Erased: false,
    DateLog: "2026-09-26T00:00:00.000Z",
    TimeLog: "1899-12-30T18:21:05.000Z",
    LeadCard: "DJ",
  },
];

describe("dedupeReceivedData", () => {
  it("keeps a lone row unchanged", () => {
    const row: ReceivedDataRow = {
      Section: 1,
      Table: 2,
      Round: 1,
      Board: 3,
      Contract: "1 NT",
      Result: "=",
      Erased: false,
    };
    const out = dedupeReceivedData([row]);
    expect(out.rows).toHaveLength(1);
    expect(out.droppedCount).toBe(0);
    expect(out.correctionsByKey.size).toBe(0);
    expect(out.rows[0].Contract).toBe("1 NT");
  });

  it("keeps latest non-erased from ronde-1 table 8 board 12 (3 NT = not -1)", () => {
    const out = dedupeReceivedData(ronde1Table8Board12);
    expect(out.rows).toHaveLength(1);
    expect(out.droppedCount).toBe(2);
    expect(out.rows[0].Contract).toBe("3 NT");
    expect(out.rows[0].Result).toBe("=");
    expect(out.rows[0].Erased).toBe(false);

    const key = receivedDataGroupKey(out.rows[0]);
    const corr = out.correctionsByKey.get(key);
    expect(corr).toBeDefined();
    expect(corr!.supersededCount).toBe(2);
    expect(corr!.previousPayload.Result).toBe("-1");
  });

  it("keeps contract denomination change from ronde-2 table 1 board 15", () => {
    const out = dedupeReceivedData(ronde2Table1Board15);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].Contract).toBe("3 H");
    expect(out.rows[0].Result).toBe("+1");
    const corr = out.correctionsByKey.get(receivedDataGroupKey(out.rows[0]));
    expect(corr?.previousPayload.Contract).toBe("3 C");
  });

  it("keeps corrected contract from ronde-3 table 5 board 12", () => {
    const out = dedupeReceivedData(ronde3Table5Board12);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].Contract).toBe("4 S");
    expect(out.rows[0].Result).toBe("-2");
    const corr = out.correctionsByKey.get(receivedDataGroupKey(out.rows[0]));
    expect(corr?.previousPayload.Contract).toBe("4 H");
    expect(corr?.previousPayload.Result).toBe("-1");
  });

  it("does not treat unrelated boards as corrections", () => {
    const other: ReceivedDataRow = {
      Section: 1,
      Table: 3,
      Round: 1,
      Board: 1,
      Contract: "2 S",
      Result: "=",
      Erased: false,
      TimeLog: "1899-12-30T12:00:00.000Z",
    };
    const out = dedupeReceivedData([...ronde1Table8Board12, other]);
    expect(out.rows).toHaveLength(2);
    expect(out.correctionsByKey.size).toBe(1);
    const keptOther = out.rows.find((r) => r.Table === 3);
    expect(keptOther?.Contract).toBe("2 S");
  });

  it("keeps lone erased row for arbiter handling", () => {
    const erasedOnly: ReceivedDataRow = {
      Section: 1,
      Table: 4,
      Round: 1,
      Board: 7,
      Contract: "1 NT",
      Result: "=",
      Erased: true,
      Remarks: "Result erased",
    };
    const out = dedupeReceivedData([erasedOnly]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].Erased).toBe(true);
    expect(out.correctionsByKey.size).toBe(0);
  });
});

describe("previousFieldsFromReceivedPayload", () => {
  it("extracts contract fields for adjustment_meta.previous", () => {
    const fields = previousFieldsFromReceivedPayload({
      Contract: "3 NT",
      Result: "-1",
      Declarer: 72,
      "NS/EW": "W",
      LeadCard: "H4",
    });
    expect(fields.Contract).toBe("3 NT");
    expect(fields.Result).toBe("-1");
    expect(fields.LeadCard).toBe("H4");
  });
});

describe("dedupeReceivedData against real honneur .bws files", () => {
  async function loadAndDedupe(filename: string) {
    const path = resolve(process.cwd(), "..", filename);
    const buffer = readFileSync(path);
    const rawRows = await parseBwsBuffer(buffer);
    const deduped = dedupeReceivedData(rawRows);
    return { rawRows, ...deduped };
  }

  it("honneur-ronde-1: one correction, keeps 3 NT =", async () => {
    const { rawRows, rows, correctionsByKey, droppedCount } =
      await loadAndDedupe("honneur-ronde-1.bws");
    expect(rawRows.length).toBe(130);
    expect(rows.length).toBe(128);
    expect(droppedCount).toBe(2);
    expect(correctionsByKey.size).toBe(1);

    const kept = rows.find(
      (r) => String(r.Table) === "8" && String(r.Board) === "12",
    );
    expect(kept?.Contract).toBe("3 NT");
    expect(kept?.Result).toBe("=");
    expect(kept?.Erased).toBe(false);
    expect(correctionsByKey.get(receivedDataGroupKey(kept!))?.previousPayload.Result).toBe(
      "-1",
    );
  });

  it("honneur-ronde-2: three corrections including 3 C → 3 H", async () => {
    const { rawRows, rows, correctionsByKey } =
      await loadAndDedupe("honneur-ronde-2.bws");
    expect(rawRows.length).toBe(134);
    expect(rows.length).toBe(128);
    expect(correctionsByKey.size).toBe(3);

    const board15 = rows.find(
      (r) => String(r.Table) === "1" && String(r.Board) === "15",
    );
    expect(board15?.Contract).toBe("3 H");
    expect(board15?.Result).toBe("+1");
  });

  it("honneur-ronde-3: one correction, keeps 4 S -2", async () => {
    const { rows, correctionsByKey } = await loadAndDedupe("honneur-ronde-3.bws");
    expect(rows.length).toBe(128);
    expect(correctionsByKey.size).toBe(1);

    const kept = rows.find(
      (r) => String(r.Table) === "5" && String(r.Board) === "12",
    );
    expect(kept?.Contract).toBe("4 S");
    expect(kept?.Result).toBe("-2");
  });
});

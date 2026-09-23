/**
 * Minimal Jet 4 inserter: copy an Access 2000 template and insert rows into
 * existing empty tables (no DDL, no indexes).
 *
 * Layout follows mdbtools HACKING.md / write.c mdb_pack_row4 and Jackcess
 * Jet4Format data-page headers.
 */

const PAGE_SIZE = 4096;
const TDEF_ROW_COUNT = 16;
const TDEF_VAR_COL_COUNT = 43;
const TDEF_COL_COUNT = 45;
const TDEF_REAL_INDEX_COUNT = 51;
const TDEF_USAGE_MAP = 55;
const TDEF_FREE_MAP = 59;
const TDEF_INDEX_START = 63;
const REAL_INDEX_ENTRY = 12;
const COL_DEF_SIZE = 25;
const DATA_RECORD_COUNT = 12;
const DATA_TDEF_PAGE = 4;
const DATA_FREE_SPACE = 2;
const DATA_HEADER = 14;
const COL_TYPE_BOOLEAN = 0x01;
const COL_TYPE_INTEGER = 0x03;
const COL_TYPE_LONG = 0x04;
const COL_TYPE_DATETIME = 0x08;
const COL_TYPE_TEXT = 0x0a;
const ACCESS_EPOCH_DAYS = 25569;

export type JetColumn = {
  name: string;
  type: number;
  index: number;
  variableIndex: number;
  flags: number;
  fixedIndex: number;
  size: number;
  fixed: boolean;
};

export type JetTableMeta = {
  name: string;
  tdefPage: number;
  columns: JetColumn[];
  variableColumnCount: number;
  usagePtr: number;
  freeMapPtr: number;
};

function pageCount(buffer: Buffer): number {
  return Math.floor(buffer.length / PAGE_SIZE);
}

function getPage(buffer: Buffer, page: number): Buffer {
  return buffer.subarray(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}

/**
 * Jet4 table definitions may span pages. Continuation pages store payload from
 * offset 8; concatenate so column defs/names parse as one logical buffer.
 */
function loadTdefLogical(buffer: Buffer, tdefPage: number): Buffer {
  const chunks: Buffer[] = [];
  let page = tdefPage;
  let first = true;
  const seen = new Set<number>();
  while (page && !seen.has(page)) {
    seen.add(page);
    const pageBuf = getPage(buffer, page);
    if (pageBuf[0] !== 2) {
      throw new Error(`Ongeldige tabeldefinitie-pagina ${page}.`);
    }
    const next = pageBuf.readUInt32LE(4);
    chunks.push(first ? Buffer.from(pageBuf) : Buffer.from(pageBuf.subarray(8)));
    first = false;
    page = next;
  }
  return Buffer.concat(chunks);
}

function recordStart(pageBuf: Buffer, row: number): number {
  return pageBuf.readUInt16LE(DATA_RECORD_COUNT + 2 + row * 2) & 0x1fff;
}

function recordEndExclusive(pageBuf: Buffer, row: number): number {
  if (row === 0) return PAGE_SIZE;
  return pageBuf.readUInt16LE(DATA_RECORD_COUNT + row * 2) & 0x1fff;
}

function findPageRow(buffer: Buffer, pageRow: number): Buffer {
  const page = pageRow >> 8;
  const row = pageRow & 0xff;
  const pageBuf = getPage(buffer, page);
  const start = recordStart(pageBuf, row);
  const end = recordEndExclusive(pageBuf, row);
  return pageBuf.subarray(start, end);
}

function parseColumns(tdef: Buffer): JetColumn[] {
  const colCount = tdef.readUInt16LE(TDEF_COL_COUNT);
  const realIndexCount = tdef.readInt32LE(TDEF_REAL_INDEX_COUNT);
  let cur = TDEF_INDEX_START + realIndexCount * REAL_INDEX_ENTRY;
  let namesPos = cur + colCount * COL_DEF_SIZE;
  const columns: JetColumn[] = [];
  for (let i = 0; i < colCount; i++) {
    const type = tdef.readUInt8(cur);
    const flags = tdef.readUInt8(cur + 15);
    const nameLen = tdef.readUInt16LE(namesPos);
    namesPos += 2;
    const name = tdef.subarray(namesPos, namesPos + nameLen).toString("utf16le");
    namesPos += nameLen;
    columns.push({
      name,
      type,
      index: tdef.readUInt8(cur + 5),
      variableIndex: tdef.readUInt8(cur + 7),
      flags,
      fixedIndex: tdef.readUInt16LE(cur + 21),
      size: tdef.readUInt16LE(cur + 23),
      fixed: !!(flags & 0x01),
    });
    cur += COL_DEF_SIZE;
  }
  columns.sort((a, b) => a.index - b.index);
  return columns;
}

function setMapBit(row: Buffer, page: number, used: boolean) {
  if (row[0] !== 0) {
    throw new Error("Alleen type-0 usage maps worden ondersteund.");
  }
  const pageStart = row.readUInt32LE(1);
  const i = page - pageStart;
  if (i < 0 || i >= (row.length - 5) * 8) {
    throw new Error(`Pagina ${page} valt buiten de usage map.`);
  }
  const byte = 5 + Math.floor(i / 8);
  const bit = i % 8;
  if (used) row[byte] |= 1 << bit;
  else row[byte] &= ~(1 << bit);
}

/** TDEF page numbers in fixtures/bridgemate/Template_Access2000_v5.bws (MSysObjects Type=1). */
const TEMPLATE_TDEF_PAGES: Record<string, number> = {
  Session: 84,
  Section: 82,
  Tables: 97,
  RoundData: 80,
  ReceivedData: 75,
  PlayerNumbers: 73,
  Settings: 86,
};

export function tableMetaFromPage(
  buffer: Buffer,
  name: string,
  tdefPage: number,
): JetTableMeta {
  const tdef = loadTdefLogical(buffer, tdefPage);
  if (tdef[0] !== 2) {
    throw new Error(`Ongeldige tabeldefinitie voor ${name}.`);
  }
  return {
    name,
    tdefPage,
    columns: parseColumns(tdef),
    variableColumnCount: tdef.readUInt16LE(TDEF_VAR_COL_COUNT),
    usagePtr: tdef.readUInt32LE(TDEF_USAGE_MAP),
    freeMapPtr: tdef.readUInt32LE(TDEF_FREE_MAP),
  };
}

function lookupTablePage(name: string): number {
  const page = TEMPLATE_TDEF_PAGES[name];
  if (page == null) {
    throw new Error(`Tabel ${name} wordt niet ondersteund in het .bws-sjabloon.`);
  }
  return page;
}

function accessDate(date: Date): Buffer {
  const days = date.getTime() / 86400000 + ACCESS_EPOCH_DAYS;
  const buf = Buffer.alloc(8);
  buf.writeDoubleLE(days);
  return buf;
}

function encodeText(value: string): Buffer {
  return Buffer.from(value, "utf16le");
}

function rowSizeForBoolean(column: JetColumn): number {
  return column.type === COL_TYPE_BOOLEAN ? 0 : column.size;
}

/** Pack one Jet 4 data row (mdb_pack_row4). */
export function packJet4Row(
  columns: JetColumn[],
  values: Record<string, unknown>,
  now: Date,
): Buffer {
  const fields = columns.map((column) => {
    const raw = values[column.name];
    const isBoolean = column.type === COL_TYPE_BOOLEAN;
    let isNull = raw === undefined || raw === null;
    let value = Buffer.alloc(0);
    const size = rowSizeForBoolean(column);
    if (isBoolean) {
      isNull = raw !== true;
    } else if (!isNull) {
      if (column.type === COL_TYPE_INTEGER) {
        value = Buffer.alloc(2);
        value.writeInt16LE(Number(raw));
      } else if (column.type === COL_TYPE_LONG) {
        value = Buffer.alloc(4);
        value.writeInt32LE(Number(raw));
      } else if (column.type === COL_TYPE_DATETIME) {
        const d = raw instanceof Date ? raw : now;
        value = Buffer.from(accessDate(d));
      } else if (column.type === COL_TYPE_TEXT) {
        value = Buffer.from(encodeText(String(raw)));
      }
    }
    return { column, isNull, value, size, isFixed: column.fixed };
  });

  const parts: Buffer[] = [];
  const numBuf = Buffer.alloc(2);
  numBuf.writeUInt16LE(columns.length);
  parts.push(numBuf);

  let pos = 2;
  for (const field of fields) {
    if (!field.isFixed) continue;
    if (!field.isNull && field.size > 0) {
      parts.push(field.value);
    } else if (field.size > 0) {
      parts.push(Buffer.alloc(field.size));
    }
    pos += field.size;
  }

  const varFields = fields.filter((f) => !f.isFixed);
  const varOffsets: number[] = [];
  if (varFields.length) {
    for (const field of varFields) {
      varOffsets.push(pos);
      if (!field.isNull && field.value.length) {
        parts.push(field.value);
        pos += field.value.length;
      }
    }
    const eod = Buffer.alloc(2);
    eod.writeUInt16LE(pos);
    parts.push(eod);
    pos += 2;
    for (let i = varFields.length - 1; i >= 0; i--) {
      const off = Buffer.alloc(2);
      off.writeUInt16LE(varOffsets[i]);
      parts.push(off);
      pos += 2;
    }
    const varCount = Buffer.alloc(2);
    varCount.writeUInt16LE(varFields.length);
    parts.push(varCount);
  }

  const maskSize = Math.floor((columns.length + 7) / 8);
  const mask = Buffer.alloc(maskSize);
  for (const field of fields) {
    if (!field.isNull) {
      const bit = field.column.index;
      mask[Math.floor(bit / 8)] |= 1 << (bit % 8);
    }
  }
  parts.push(mask);
  return Buffer.concat(parts);
}

function appendDataPage(
  buffer: Buffer,
  tdefPage: number,
): { buffer: Buffer; page: number } {
  const page = pageCount(buffer);
  const data = Buffer.alloc(PAGE_SIZE);
  data[0] = 0x01;
  data[1] = 0x01;
  data.writeUInt16LE(PAGE_SIZE - DATA_HEADER, DATA_FREE_SPACE);
  data.writeUInt32LE(tdefPage, DATA_TDEF_PAGE);
  data.writeUInt32LE(0, 8);
  data.writeUInt16LE(0, DATA_RECORD_COUNT);
  return { buffer: Buffer.concat([buffer, data]), page };
}

function canFitRow(pageBuf: Buffer, rowLength: number): boolean {
  const recs = pageBuf.readUInt16LE(DATA_RECORD_COUNT);
  const offsetTableEnd = DATA_HEADER + (recs + 1) * 2;
  const lowestRecord = recs === 0 ? PAGE_SIZE : recordStart(pageBuf, recs - 1);
  return lowestRecord - rowLength >= offsetTableEnd;
}

function addRowToDataPage(pageBuf: Buffer, row: Buffer) {
  if (!canFitRow(pageBuf, row.length)) {
    throw new Error("Datapagina is vol.");
  }
  const recs = pageBuf.readUInt16LE(DATA_RECORD_COUNT);
  const offsetTableEnd = DATA_HEADER + (recs + 1) * 2;
  const lowestRecord = recs === 0 ? PAGE_SIZE : recordStart(pageBuf, recs - 1);
  const newStart = lowestRecord - row.length;
  row.copy(pageBuf, newStart);
  pageBuf.writeUInt16LE(newStart, DATA_RECORD_COUNT + 2 + recs * 2);
  pageBuf.writeUInt16LE(recs + 1, DATA_RECORD_COUNT);
  const used = offsetTableEnd + (PAGE_SIZE - newStart);
  pageBuf.writeUInt16LE(PAGE_SIZE - used, DATA_FREE_SPACE);
}

function bumpRowCount(buffer: Buffer, tdefPage: number, add: number) {
  const tdef = getPage(buffer, tdefPage);
  tdef.writeUInt32LE(tdef.readUInt32LE(TDEF_ROW_COUNT) + add, TDEF_ROW_COUNT);
}

/** Insert rows into an existing empty Jet 4 table. */
export function insertRows(
  buffer: Buffer,
  tableName: string,
  rows: Array<Record<string, unknown>>,
  now: Date = new Date(),
): Buffer {
  if (!rows.length) return buffer;
  const tdefPage = lookupTablePage(tableName);
  const meta = tableMetaFromPage(buffer, tableName, tdefPage);
  const packed = rows.map((row) => packJet4Row(meta.columns, row, now));

  let out = buffer;
  const allocated: number[] = [];
  let currentPage = -1;
  let pageBuf: Buffer | null = null;

  for (const row of packed) {
    const needNew =
      currentPage < 0 || !pageBuf || !canFitRow(pageBuf, row.length);
    if (needNew) {
      const grown = appendDataPage(out, meta.tdefPage);
      out = grown.buffer;
      currentPage = grown.page;
      allocated.push(currentPage);
      pageBuf = getPage(out, currentPage);
    }
    addRowToDataPage(pageBuf!, row);
  }

  bumpRowCount(out, meta.tdefPage, rows.length);

  for (const page of allocated) {
    setMapBit(findPageRow(out, meta.usagePtr), page, true);
    setMapBit(findPageRow(out, meta.freeMapPtr), page, true);
    // Global map on page 1 row 0: 1 = free, 0 = used.
    setMapBit(findPageRow(out, (1 << 8) | 0), page, false);
  }

  return out;
}

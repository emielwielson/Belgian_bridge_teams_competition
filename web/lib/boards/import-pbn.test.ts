import { describe, expect, it, vi } from "vitest";
import { importPbnForHonorRound } from "./import-pbn";

const SAMPLE_PBN = `[Board "1"]
[Dealer "N"]
[Vulnerable "None"]
[Deal "N:AKQ.JT9.876.5432 JT9.AKQ.5432.876 876.5432.AKQ.JT9 5432.876.JT9.AKQ"]

[Board "2"]
[Dealer "E"]
[Vulnerable "NS"]
[Deal "N:AKQ.JT9.876.5432 JT9.AKQ.5432.876 876.5432.AKQ.JT9 5432.876.JT9.AKQ"]
`;

type BoardRow = { id: string; board_number: number };

function createMockService(initial: BoardRow[]) {
  const boards = [...initial];
  const deletedIds: string[] = [];

  const service = {
    from(table: string) {
      if (table === "honor_raw_imports") {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }

      return {
        select(cols: string) {
          const filters: Record<string, unknown> = {};
          const api = {
            eq(col: string, val: unknown) {
              filters[col] = val;
              return api;
            },
            maybeSingle: async () => {
              const row = boards.find(
                (b) => b.board_number === filters.board_number,
              );
              return { data: row ? { id: row.id } : null, error: null };
            },
            // When awaited without maybeSingle → list query
            then(
              onFulfilled: (value: {
                data: BoardRow[];
                error: null;
              }) => unknown,
            ) {
              return Promise.resolve(
                onFulfilled({ data: [...boards], error: null }),
              );
            },
          };
          void cols;
          return api;
        },
        update() {
          return {
            eq(idCol: string, id: string) {
              void idCol;
              return {
                select() {
                  return {
                    single: async () => ({ data: { id }, error: null }),
                  };
                },
              };
            },
          };
        },
        insert(payload: { board_number: number }) {
          const id = `new-${payload.board_number}`;
          boards.push({ id, board_number: payload.board_number });
          return {
            select() {
              return {
                single: async () => ({ data: { id }, error: null }),
              };
            },
          };
        },
        delete() {
          return {
            in(_col: string, ids: string[]) {
              for (const id of ids) {
                deletedIds.push(id);
                const idx = boards.findIndex((b) => b.id === id);
                if (idx >= 0) boards.splice(idx, 1);
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  return { service, deletedIds, boards };
}

describe("importPbnForHonorRound", () => {
  it("removes stale board numbers not present in the PBN", async () => {
    const { service, deletedIds } = createMockService([
      { id: "stale-17", board_number: 17 },
      { id: "stale-18", board_number: 18 },
      { id: "keep-1", board_number: 1 },
    ]);

    const result = await importPbnForHonorRound(service as never, {
      groupId: "g1",
      tournamentRound: 4,
      pbnText: SAMPLE_PBN,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.boardCount).toBe(2);
    expect(result.removedStale).toBe(2);
    expect(deletedIds.sort()).toEqual(["stale-17", "stale-18"]);
  });
});

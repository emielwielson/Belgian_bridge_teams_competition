import { describe, expect, it, vi } from "vitest";
import { selectAllRows } from "./select-all";

describe("selectAllRows", () => {
  it("returns a single page when under the page size", async () => {
    const runPage = vi.fn(async () => ({
      data: [{ id: 1 }, { id: 2 }],
      error: null,
    }));

    const { data, error } = await selectAllRows(runPage, 1000);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(runPage).toHaveBeenCalledTimes(1);
    expect(runPage).toHaveBeenCalledWith(0, 999);
  });

  it("pages until a short page is returned", async () => {
    const runPage = vi.fn(async (from: number) => {
      if (from === 0) {
        return { data: [1, 2, 3], error: null };
      }
      if (from === 3) {
        return { data: [4, 5, 6], error: null };
      }
      return { data: [7], error: null };
    });

    const { data, error } = await selectAllRows(runPage, 3);
    expect(error).toBeNull();
    expect(data).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(runPage).toHaveBeenCalledTimes(3);
    expect(runPage).toHaveBeenNthCalledWith(1, 0, 2);
    expect(runPage).toHaveBeenNthCalledWith(2, 3, 5);
    expect(runPage).toHaveBeenNthCalledWith(3, 6, 8);
  });

  it("stops and returns the error from a failed page", async () => {
    const runPage = vi.fn(async (from: number) => {
      if (from === 0) {
        return { data: [1, 2], error: null };
      }
      return { data: null, error: { message: "boom" } };
    });

    const { data, error } = await selectAllRows(runPage, 2);
    expect(error).toEqual({ message: "boom" });
    expect(data).toEqual([1, 2]);
    expect(runPage).toHaveBeenCalledTimes(2);
  });

  it("rejects a non-positive page size", async () => {
    const { data, error } = await selectAllRows(async () => ({
      data: [],
      error: null,
    }), 0);
    expect(data).toEqual([]);
    expect(error?.message).toMatch(/Invalid pageSize/);
  });
});

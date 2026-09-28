import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  readActiveTeamId,
  resolveActiveTeamId,
  writeActiveTeamId,
} from "./active-team";

describe("active-team", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves to first team when nothing stored", () => {
    expect(
      resolveActiveTeamId([
        { id: "t1" },
        { id: "t2" },
      ]),
    ).toBe("t1");
  });

  it("prefers a stored team that is still in the roster", () => {
    writeActiveTeamId("t2");
    expect(readActiveTeamId()).toBe("t2");
    expect(
      resolveActiveTeamId([
        { id: "t1" },
        { id: "t2" },
      ]),
    ).toBe("t2");
  });

  it("falls back when stored team is no longer in the roster", () => {
    writeActiveTeamId("gone");
    expect(resolveActiveTeamId([{ id: "t1" }, { id: "t2" }])).toBe("t1");
  });

  it("returns null for an empty roster", () => {
    expect(resolveActiveTeamId([])).toBeNull();
  });
});

import { afterEach, describe, expect, test } from "vitest";
import { getDatabase, getDatabaseBackend, resetDatabaseBackend } from "@/lib/server/db";

const originalEnv = { ...process.env };

describe("database backend factory", () => {
  afterEach(() => {
    resetDatabaseBackend();
    process.env = { ...originalEnv };
  });

  test("initializes exactly one local SQLite backend by default", () => {
    process.env = {
      ...originalEnv,
      DATABASE_PROVIDER: "sqlite",
      DATABASE_PATH: ":memory:",
      VERCEL: undefined,
    };

    const first = getDatabaseBackend();
    const second = getDatabaseBackend();

    expect(first).toBe(second);
    expect(first.provider).toBe("sqlite");
    expect("getSqliteDatabase" in first).toBe(true);
    const sqliteDatabase = first.getSqliteDatabase?.();
    expect(getDatabase()).toBe(sqliteDatabase);
  });
});

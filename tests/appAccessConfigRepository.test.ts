import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteAppAccessConfigRepository } from "@/lib/server/db/sqliteAppAccessConfigRepository";
import { hydrateAppAccessTokenFromDatabase, syncAppAccessTokenToEnv } from "@/lib/server/appAccessToken";
import { restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("SqliteAppAccessConfigRepository", () => {
  test("ensureToken creates and reuses a singleton token", () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteAppAccessConfigRepository(db);

    const first = repository.ensureToken();
    const second = repository.ensureToken();

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(20);
    expect(repository.getToken()).toBe(first);
  });
});

describe("appAccessToken env hydration", () => {
  beforeEach(() => {
    delete process.env.APP_ACCESS_TOKEN;
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
  });

  test("hydrateAppAccessTokenFromDatabase sets env when unset", () => {
    hydrateAppAccessTokenFromDatabase("db-token");
    expect(process.env.APP_ACCESS_TOKEN).toBe("db-token");
  });

  test("hydrateAppAccessTokenFromDatabase keeps configured env token", () => {
    withTestAppAccessToken();
    hydrateAppAccessTokenFromDatabase("db-token");
    expect(process.env.APP_ACCESS_TOKEN).toBe("test-app-access-token");
  });

  test("syncAppAccessTokenToEnv updates process env", () => {
    syncAppAccessTokenToEnv("synced-token");
    expect(process.env.APP_ACCESS_TOKEN).toBe("synced-token");
  });
});

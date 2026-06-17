import { describe, expect, test } from "vitest";
import { readDatabaseConfig } from "@/lib/server/databaseConfig";
import { isDevQuickLoginAvailable } from "@/lib/server/devAuth";

describe("isDevQuickLoginAvailable", () => {
  test("requires development sqlite and not Vercel", () => {
    expect(
      isDevQuickLoginAvailable({
        NODE_ENV: "development",
        DATABASE_PROVIDER: "sqlite",
      }),
    ).toBe(true);

    expect(
      isDevQuickLoginAvailable({
        NODE_ENV: "development",
        DATABASE_PROVIDER: "sqlite",
        VERCEL: "1",
      }),
    ).toBe(false);

    expect(
      isDevQuickLoginAvailable({
        NODE_ENV: "production",
        DATABASE_PROVIDER: "sqlite",
      }),
    ).toBe(false);

    expect(
      isDevQuickLoginAvailable({
        NODE_ENV: "development",
        DATABASE_PROVIDER: "turso",
        TURSO_DATABASE_URL: "https://example.turso.io",
        TURSO_AUTH_TOKEN: "token",
      }),
    ).toBe(false);
  });

  test("uses readDatabaseConfig defaults for sqlite", () => {
    expect(readDatabaseConfig({ DATABASE_PROVIDER: "sqlite" }).provider).toBe("sqlite");
  });
});

import { describe, expect, test } from "vitest";
import { getDefaultDatabasePath, readDatabaseConfig } from "@/lib/server/databaseConfig";

describe("databaseConfig", () => {
  test("defaults to local SQLite", () => {
    expect(readDatabaseConfig({})).toEqual({
      provider: "sqlite",
      path: getDefaultDatabasePath(),
    });
  });

  test("uses configured SQLite path", () => {
    expect(readDatabaseConfig({ DATABASE_PROVIDER: "sqlite", DATABASE_PATH: "data/test.db" })).toEqual({
      provider: "sqlite",
      path: "data/test.db",
    });
  });

  test("rejects unknown providers", () => {
    expect(() => readDatabaseConfig({ DATABASE_PROVIDER: "postgres" })).toThrow(
      "DATABASE_PROVIDER must be sqlite or turso",
    );
  });

  test("rejects SQLite on Vercel", () => {
    expect(() => readDatabaseConfig({ DATABASE_PROVIDER: "sqlite", VERCEL: "1" })).toThrow(
      "DATABASE_PROVIDER=sqlite is not supported on Vercel",
    );
  });

  test("requires Turso credentials when Turso is selected", () => {
    expect(() => readDatabaseConfig({ DATABASE_PROVIDER: "turso" })).toThrow(
      "TURSO_DATABASE_URL is required when DATABASE_PROVIDER=turso",
    );
    expect(() => readDatabaseConfig({ DATABASE_PROVIDER: "turso", TURSO_DATABASE_URL: "libsql://example" })).toThrow(
      "TURSO_AUTH_TOKEN is required when DATABASE_PROVIDER=turso",
    );
  });

  test("returns Turso config when credentials are set", () => {
    expect(
      readDatabaseConfig({
        DATABASE_PROVIDER: "turso",
        TURSO_DATABASE_URL: " libsql://applied-example.turso.io ",
        TURSO_AUTH_TOKEN: " token ",
      }),
    ).toEqual({
      provider: "turso",
      url: "libsql://applied-example.turso.io",
      authToken: "token",
    });
  });
});

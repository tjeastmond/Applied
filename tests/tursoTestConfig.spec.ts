import { describe, expect, test } from "vitest";
import { requireTursoTestConfig, resolveTursoTestConfig } from "./helpers/tursoTestConfig";

describe("tursoTestConfig", () => {
  test("reads dedicated Turso test credentials only", () => {
    expect(
      resolveTursoTestConfig({
        TURSO_DATABASE_URL: "libsql://app.example.com",
        TURSO_AUTH_TOKEN: "app-token",
        TURSO_TEST_DATABASE_URL: "libsql://test.example.com",
        TURSO_TEST_AUTH_TOKEN: "test-token",
      }),
    ).toEqual({
      url: "libsql://test.example.com",
      authToken: "test-token",
    });
  });

  test("ignores app credentials when test credentials are absent", () => {
    expect(
      resolveTursoTestConfig({
        TURSO_DATABASE_URL: "libsql://app.example.com",
        TURSO_AUTH_TOKEN: "app-token",
      }),
    ).toBeNull();
  });

  test("returns null when credentials are missing", () => {
    expect(resolveTursoTestConfig({})).toBeNull();
    expect(resolveTursoTestConfig({ TURSO_TEST_DATABASE_URL: "libsql://test.example.com" })).toBeNull();
  });

  test("requireTursoTestConfig throws a helpful error when credentials are missing", () => {
    expect(() => requireTursoTestConfig({})).toThrow(/Turso integration tests require/);
  });
});

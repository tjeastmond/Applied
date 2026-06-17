import { describe, expect, test } from "vitest";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteAgentApiTokenRepository } from "@/lib/server/db/sqliteAgentApiTokenRepository";

describe("SqliteAgentApiTokenRepository", () => {
  test("create returns token once and listActive shows prefix metadata", () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteAgentApiTokenRepository(db);

    const created = repository.create("Cursor Agent");
    const listed = repository.listActive();

    expect(created.token.length).toBeGreaterThan(20);
    expect(created.record.name).toBe("Cursor Agent");
    expect(created.record.tokenPrefix).toBe(created.token.slice(0, 8));
    expect(listed).toEqual([created.record]);
    expect(repository.hasActiveTokens()).toBe(true);
    expect(repository.isValidToken(created.token)).toBe(true);
    expect(repository.isValidToken("wrong-token")).toBe(false);
  });

  test("revoke removes token from active list and invalidates bearer", () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteAgentApiTokenRepository(db);
    const created = repository.create("Revoke Me");

    expect(repository.revoke(created.record.id)).toBe(true);
    expect(repository.listActive()).toEqual([]);
    expect(repository.hasActiveTokens()).toBe(false);
    expect(repository.isValidToken(created.token)).toBe(false);
    expect(repository.revoke(created.record.id)).toBe(false);
  });
});

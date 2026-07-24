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
    expect(created.record.lastUsedAt).toBeNull();
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

  test("importFromRawToken stores hashed token without returning the secret", () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteAgentApiTokenRepository(db);
    const rawToken = "bootstrap-env-token-value";

    const imported = repository.importFromRawToken("Environment", rawToken);

    expect(imported.record.name).toBe("Environment");
    expect(imported.record.lastUsedAt).toBeNull();
    expect(repository.hasActiveTokenWithHash(rawToken)).toBe(true);
    expect(repository.isValidToken(rawToken)).toBe(true);
  });

  test("touchLastUsed updates sort order by recent use", () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteAgentApiTokenRepository(db);
    const older = repository.create("Older");
    const newer = repository.create("Newer");

    repository.touchLastUsed(older.token);

    const listed = repository.listActive();
    expect(listed[0]?.id).toBe(older.record.id);
    expect(listed[0]?.lastUsedAt).not.toBeNull();
    expect(listed[1]?.id).toBe(newer.record.id);
  });

  test("updateName changes display name for active token", () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteAgentApiTokenRepository(db);
    const created = repository.create("Old Name");

    const updated = repository.updateName(created.record.id, "New Name");

    expect(updated?.name).toBe("New Name");
    expect(repository.listActive()[0]?.name).toBe("New Name");
    expect(repository.updateName("00000000-0000-4000-8000-000000000001", "Missing")).toBeNull();
  });
});

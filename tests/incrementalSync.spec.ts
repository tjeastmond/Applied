import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type Database from "better-sqlite3";
import type { Client, InStatement, ResultSet, Transaction } from "@tursodatabase/serverless/compat";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteDatabaseBackend } from "@/lib/server/db/sqliteBackend";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { syncDestinationKey, syncIncrementally } from "@/lib/server/services/incrementalSyncService";
import { createTursoSyncTarget } from "@/lib/server/services/tursoSyncTarget";
import { SYNC_TABLES, syncColumns, type SyncBatch } from "@/lib/server/services/syncProtocol";

const databases: Database.Database[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});
function database() {
  const db = openDatabase(":memory:");
  databases.push(db);
  return db;
}
function backend(db: Database.Database) {
  return new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, db);
}
function createApp(source: SqliteDatabaseBackend, suffix = "one") {
  return source.applications.create(
    createJobApplicationSchema.parse({
      url: `https://example.com/${suffix}`,
      title: suffix,
      company: "Acme",
      appliedAt: "2026-09-21",
    }),
  );
}
// Run the actual Turso adapter against SQLite with a small driver shim. This tests
// SQL, FK constraints, transactions, rollback and receipts, not an in-memory map.
function localTarget(db: Database.Database) {
  const execute = vi.fn((input: InStatement): Promise<ResultSet> => {
    const sql = typeof input === "string" ? input : input.sql;
    const args = typeof input === "string" ? undefined : input.args;
    const statement = db.prepare(sql);
    const bindings = Array.isArray(args) ? args : args ? [args] : [];
    const rows = statement.reader ? statement.all(...bindings) : (statement.run(...bindings), []);
    return Promise.resolve({ rows } as ResultSet);
  });
  const transaction = () => {
    db.exec("BEGIN IMMEDIATE");
    let closed = false;
    return Promise.resolve({
      execute,
      commit() {
        db.exec("COMMIT");
        closed = true;
        return Promise.resolve();
      },
      rollback() {
        db.exec("ROLLBACK");
        closed = true;
        return Promise.resolve();
      },
      close() {
        if (!closed) db.exec("ROLLBACK");
        closed = true;
        return Promise.resolve();
      },
      get closed() {
        return closed;
      },
    } as unknown as Transaction);
  };
  return { ...createTursoSyncTarget({ execute, transaction } as unknown as Client), execute };
}
function records(db: Database.Database) {
  return Object.fromEntries(
    SYNC_TABLES.map(({ table, sql }) => [
      table,
      db.prepare(`SELECT ${syncColumns(sql).join(", ")} FROM ${table} ORDER BY id`).all(),
    ]),
  );
}
function setup() {
  const sourceDb = database(),
    targetDb = database();
  return { sourceDb, targetDb, source: backend(sourceDb), target: localTarget(targetDb) };
}

describe("incremental Turso sync", () => {
  test("baseline is identical; no-op sends zero records and performs no target table scans", async () => {
    const { sourceDb, targetDb, source, target } = setup();
    const app = await createApp(source);
    await source.notes.create(app.id, "Original note");
    const first = await syncIncrementally(sourceDb, target, "test");
    expect(first.mode).toBe("baseline");
    expect(records(targetDb)).toEqual(records(sourceDb));
    target.execute.mockClear();
    const unchanged = await syncIncrementally(sourceDb, target, "test");
    expect(unchanged).toMatchObject({ batches: 0, payloadBytes: 0 });
    expect(target.execute.mock.calls.every(([stmt]) => typeof stmt === "string" && stmt.includes("sync_receipt"))).toBe(
      true,
    );
  });

  test("sends one changed application out of 200, collapses edits, and excludes credentials", async () => {
    const { sourceDb, targetDb, source, target } = setup();
    let id = "";
    for (let i = 0; i < 200; i++) id = (await createApp(source, String(i))).id;
    sourceDb.exec("UPDATE users SET password_hash = 'secret' ");
    const first = await syncIncrementally(sourceDb, target, "test");
    sourceDb.prepare("UPDATE applications SET title = ? WHERE id = ?").run("Edit 1", id);
    sourceDb.prepare("UPDATE applications SET title = ? WHERE id = ?").run("Edit 2", id);
    const batches: SyncBatch[] = [];
    const delta = await syncIncrementally(
      sourceDb,
      {
        ...target,
        async applySyncBatch(batch) {
          batches.push(batch);
          await target.applySyncBatch(batch);
        },
      },
      "test",
    );
    expect(delta.imported.applications).toBe(1);
    expect(Object.values(delta.imported).reduce((a, b) => a + b, 0)).toBe(1);
    expect(delta.payloadBytes).toBeLessThan(first.payloadBytes / 50);
    process.stdout.write(
      `Local sync evidence: 200 applications; baseline ${first.payloadBytes} bytes; one-row delta ${delta.payloadBytes} bytes; unchanged 0 record bytes.\n`,
    );
    expect(records(targetDb)).toEqual(records(sourceDb));
    expect(JSON.stringify(batches)).not.toContain("password_hash");
    expect(targetDb.prepare("SELECT password_hash FROM users").get()).toEqual({ password_hash: null });
  });

  test("captures note edits without timestamps, deletes, cascades, company and user updates", async () => {
    const { sourceDb, targetDb, source, target } = setup();
    const app = await createApp(source);
    const removed = await createApp(source, "removed");
    await source.companies.create({ name: "Acme" });
    const note = await source.notes.create(app.id, "Before");
    const deleted = await source.notes.create(app.id, "Remove me");
    await source.notes.create(removed.id, "Cascade");
    await syncIncrementally(sourceDb, target, "test");
    sourceDb.prepare("UPDATE application_notes SET content = ? WHERE id = ?").run("After", note.id);
    sourceDb.prepare("DELETE FROM application_notes WHERE id = ?").run(deleted.id);
    await source.applications.delete(removed.id);
    sourceDb.exec("UPDATE users SET display_name = 'New name'; UPDATE companies SET ignored = 1");
    const result = await syncIncrementally(sourceDb, target, "test");
    expect(result.imported).toMatchObject({ notes: 1, users: 1, companies: 1 });
    expect(result.deleted).toMatchObject({ applications: 1, notes: 2, statusHistory: 1 });
    expect(records(targetDb)).toEqual(records(sourceDb));
    expect(targetDb.pragma("foreign_key_check")).toEqual([]);
  });

  test("failed batch rolls back rows and receipt; retry uses immutable data and later captures concurrent edits", async () => {
    const { sourceDb, targetDb, source, target } = setup();
    const app = await createApp(source);
    await syncIncrementally(sourceDb, target, "test");
    sourceDb.prepare("UPDATE applications SET title = 'Captured' WHERE id = ?").run(app.id);
    const previous = records(targetDb);
    const originalExecute = target.execute.getMockImplementation()!;
    let fail = true;
    target.execute.mockImplementation(async (stmt) => {
      if (fail && typeof stmt !== "string" && stmt.sql.startsWith("INSERT INTO sync_receipt"))
        throw new Error("Simulated write failure");
      return originalExecute(stmt);
    });
    await expect(syncIncrementally(sourceDb, target, "test")).rejects.toThrow("Simulated write failure");
    expect(records(targetDb)).toEqual(previous);
    sourceDb.prepare("UPDATE applications SET title = 'Concurrent edit' WHERE id = ?").run(app.id);
    fail = false;
    await syncIncrementally(sourceDb, target, "test");
    expect(targetDb.prepare("SELECT title FROM applications WHERE id = ?").get(app.id)).toEqual({ title: "Captured" });
    await syncIncrementally(sourceDb, target, "test");
    expect(records(targetDb)).toEqual(records(sourceDb));
  });

  test("resumes across batches and lost commit acknowledgement without reapplying a committed batch", async () => {
    const { sourceDb, targetDb, source, target } = setup();
    for (let i = 0; i < 75; i++) await createApp(source, String(i));
    let calls = 0;
    await expect(
      syncIncrementally(
        sourceDb,
        {
          ...target,
          async applySyncBatch(batch) {
            await target.applySyncBatch(batch);
            if (++calls === 2) throw new Error("Response lost");
          },
        },
        "test",
      ),
    ).rejects.toThrow("Response lost");
    expect(sourceDb.prepare("SELECT checkpoint, next_batch FROM sync_destinations").get()).toEqual({
      checkpoint: 0,
      next_batch: 1,
    });
    await syncIncrementally(sourceDb, target, "test");
    expect(records(targetDb)).toEqual(records(sourceDb));
    expect(sourceDb.prepare("SELECT count(*) AS count FROM sync_changes").get()).toEqual({ count: 0 });
  });

  test("does not lose changes made while sending; rolled-back writes are not journaled", async () => {
    const { sourceDb, targetDb, source, target } = setup();
    const app = await createApp(source);
    await syncIncrementally(
      sourceDb,
      {
        ...target,
        async applySyncBatch(batch) {
          sourceDb.prepare("UPDATE applications SET title = 'During sync' WHERE id = ?").run(app.id);
          await target.applySyncBatch(batch);
        },
      },
      "test",
    );
    await syncIncrementally(sourceDb, target, "test");
    expect(records(targetDb)).toEqual(records(sourceDb));
    expect(() =>
      sourceDb.transaction(() => {
        sourceDb.prepare("UPDATE applications SET title = 'Rolled back' WHERE id = ?").run(app.id);
        throw new Error("Abort");
      })(),
    ).toThrow("Abort");
    expect((await syncIncrementally(sourceDb, target, "test")).batches).toBe(0);
  });

  test("keeps separate destination checkpoints and detects target reset", async () => {
    const { sourceDb, source, target } = setup();
    const secondDb = database(),
      second = localTarget(secondDb);
    const app = await createApp(source);
    await syncIncrementally(sourceDb, target, "one");
    await syncIncrementally(sourceDb, second, "two");
    sourceDb.prepare("UPDATE applications SET title = 'Both' WHERE id = ?").run(app.id);
    await syncIncrementally(sourceDb, target, "one");
    expect((await syncIncrementally(sourceDb, second, "two")).imported.applications).toBe(1);
    expect(records(secondDb)).toEqual(records(sourceDb));
    secondDb.exec("DELETE FROM sync_receipt");
    await expect(syncIncrementally(sourceDb, second, "two")).rejects.toThrow("checkpoint changed");
    expect((await syncIncrementally(sourceDb, second, "two", true)).mode).toBe("baseline");
  });

  test("rejects stale batches after a newer sync; full recovery can abandon a failed plan", async () => {
    const { sourceDb, source, target, targetDb } = setup();
    await createApp(source);
    let saved: SyncBatch | undefined;
    await syncIncrementally(
      sourceDb,
      {
        ...target,
        async applySyncBatch(batch) {
          saved = batch;
          await target.applySyncBatch(batch);
        },
      },
      "test",
    );
    await createApp(source, "new");
    await syncIncrementally(sourceDb, target, "test");
    await expect(target.applySyncBatch(saved!)).rejects.toThrow("checkpoint changed");
    sourceDb.exec("UPDATE applications SET title = 'Latest'");
    await expect(
      syncIncrementally(
        sourceDb,
        {
          ...target,
          applySyncBatch() {
            return Promise.reject(new Error("Offline"));
          },
        },
        "test",
      ),
    ).rejects.toThrow("Offline");
    await syncIncrementally(sourceDb, target, "test", true);
    expect(records(targetDb)).toEqual(records(sourceDb));
  });

  test("resumes the saved snapshot after closing and reopening the source database", async () => {
    const directory = mkdtempSync(join(tmpdir(), "applied-sync-"));
    const path = join(directory, "source.db");
    let db = openDatabase(path);
    const targetDb = database();
    const target = localTarget(targetDb);
    try {
      const source = backend(db);
      await source.companies.create({ name: "Acme" });
      await createApp(source);
      await expect(
        syncIncrementally(
          db,
          {
            ...target,
            applySyncBatch() {
              return Promise.reject(new Error("Offline"));
            },
          },
          "restart",
        ),
      ).rejects.toThrow("Offline");
      db.close();
      db = openDatabase(path);
      await syncIncrementally(db, target, "restart");
      expect(records(targetDb)).toEqual(records(db));
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("JSON and SQL imports remain compatible and their changes are captured", async () => {
    const { sourceDb, targetDb, source, target } = setup();
    const app = await createApp(source);
    await source.companies.create({ name: "Acme" });
    await syncIncrementally(sourceDb, target, "imports");
    const backup = await source.exportJson();
    backup.applications[0].title = "Imported edit";
    await source.importJson(backup, "upsert");
    await syncIncrementally(sourceDb, target, "imports");
    expect(records(targetDb)).toEqual(records(sourceDb));
    const sql = await source.exportSql();
    expect(sql).not.toContain("sync_changes");
    expect(JSON.stringify(backup)).not.toContain("sync_destinations");
    await source.applications.delete(app.id);
    await syncIncrementally(sourceDb, target, "imports");
    await source.importSql(sql, "replace");
    await syncIncrementally(sourceDb, target, "imports");
    expect(records(targetDb)).toEqual(records(sourceDb));
  });

  test("batch boundaries respect record limits and credential-only writes produce no delta", async () => {
    const { sourceDb, source, target } = setup();
    for (let i = 0; i < 26; i++) await createApp(source, String(i));
    const batches: SyncBatch[] = [];
    await syncIncrementally(
      sourceDb,
      {
        ...target,
        async applySyncBatch(batch) {
          batches.push(batch);
          await target.applySyncBatch(batch);
        },
      },
      "limits",
    );
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((batch) => batch.operations.length <= 50)).toBe(true);
    sourceDb.exec("UPDATE users SET password_hash = 'never-transfer-this'");
    expect((await syncIncrementally(sourceDb, target, "limits")).batches).toBe(0);
  });

  test("canonical destination identity ignores transport spelling and credentials", () => {
    expect(syncDestinationKey("libsql://example.turso.io")).toBe(syncDestinationKey("https://example.turso.io/"));
  });
});

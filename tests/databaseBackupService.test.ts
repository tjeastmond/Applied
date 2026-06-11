import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { openDatabase } from "@/lib/server/db/migrate";
import {
  createDatabaseBackup,
  databaseBackupEntryFilename,
  databaseBackupFilename,
} from "@/lib/server/services/databaseBackupService";

describe("databaseBackupService", () => {
  test("databaseBackupFilename uses database base name and timestamp", () => {
    const filename = databaseBackupFilename(new Date("2026-06-11T12:30:00.000Z"), "/data/applied.db");
    expect(filename).toBe("applied-backup-2026-06-11T12-30-00-000Z.zip");
  });

  test("databaseBackupEntryFilename uses database base name and timestamp", () => {
    const filename = databaseBackupEntryFilename(new Date("2026-06-11T12:30:00.000Z"), "/data/applied.db");
    expect(filename).toBe("applied-backup-2026-06-11T12-30-00-000Z.db");
  });

  test("createDatabaseBackup returns a standard zip archive", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "applied-db-backup-"));

    const db = openDatabase(":memory:");
    db.exec(`CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)`);
    db.prepare(`INSERT INTO sample (value) VALUES (?)`).run("hello");

    const result = await createDatabaseBackup(db, {
      tempDir: tempRoot,
      createdAt: new Date("2026-06-11T12:30:00.000Z"),
    });

    expect(result.filename).toBe("applied-backup-2026-06-11T12-30-00-000Z.zip");
    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.data.subarray(0, 4).toString("utf8")).toBe("PK\u0003\u0004");

    db.close();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("createDatabaseBackup cleans up temp files when using default temp dir", async () => {
    const db = openDatabase(":memory:");
    const result = await createDatabaseBackup(db);

    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.data.subarray(0, 4).toString("utf8")).toBe("PK\u0003\u0004");

    db.close();
  });
});

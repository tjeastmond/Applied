import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteAppAccessConfigRepository } from "@/lib/server/db/sqliteAppAccessConfigRepository";
import { SqliteApplicationNoteRepository } from "@/lib/server/db/sqliteApplicationNoteRepository";
import { SqliteJobApplicationRepository } from "@/lib/server/db/sqliteRepository";
import { stripSensitiveDataFromDatabase } from "@/lib/server/services/databaseBackupService";
import { exportJson, exportSql, importJson, importSql } from "@/lib/server/services/backupService";

async function seedSampleData(db: ReturnType<typeof openDatabase>) {
  const appRepo = new SqliteJobApplicationRepository(db);
  const noteRepo = new SqliteApplicationNoteRepository(db);

  const application = await appRepo.create(
    createJobApplicationSchema.parse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      status: "applied",
    }),
  );

  await noteRepo.create(application.id, "Follow up next week.");
  return application;
}

describe("backupService", () => {
  test("exports and imports JSON with replace mode", async () => {
    const db = openDatabase(":memory:");
    await seedSampleData(db);

    const exported = exportJson(db);
    expect(exported.applications).toHaveLength(1);
    expect(exported.notes).toHaveLength(1);

    await appRepoCreateSecond(db);

    const result = importJson(db, exported, "replace");
    expect(result.imported.applications).toBe(1);
    expect(result.imported.notes).toBe(1);
    expect(result.applications).toHaveLength(1);
    expect(result.applications[0]?.company).toBe("Acme");
  });

  test("imports JSON with upsert mode without removing existing records", async () => {
    const db = openDatabase(":memory:");
    const original = await seedSampleData(db);
    const exported = exportJson(db);

    const appRepo = new SqliteJobApplicationRepository(db);
    const second = await appRepo.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/other",
        title: "Designer",
        company: "Beta",
        appliedAt: "2026-06-02",
      }),
    );

    const updatedExport = {
      ...exported,
      applications: exported.applications.map((application) =>
        application.id === original.id ? { ...application, company: "Acme Updated" } : application,
      ),
    };

    const result = importJson(db, updatedExport, "upsert");
    expect(result.applications).toHaveLength(2);
    expect(result.applications.find((application) => application.id === original.id)?.company).toBe("Acme Updated");
    expect(result.applications.find((application) => application.id === second.id)?.company).toBe("Beta");
  });

  test("exports and imports SQL with replace mode", async () => {
    const db = openDatabase(":memory:");
    await seedSampleData(db);

    const sql = exportSql(db);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS applications");
    expect(sql).toContain("INSERT INTO applications");

    const appRepo = new SqliteJobApplicationRepository(db);
    await appRepo.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/extra",
        title: "PM",
        company: "Gamma",
        appliedAt: "2026-06-03",
      }),
    );

    const result = importSql(db, sql, "replace");
    expect(result.imported.applications).toBe(1);
    expect(result.applications).toHaveLength(1);
    expect(result.applications[0]?.title).toBe("Engineer");
  });

  test("imports SQL with upsert mode", async () => {
    const db = openDatabase(":memory:");
    await seedSampleData(db);
    const sql = exportSql(db);

    const appRepo = new SqliteJobApplicationRepository(db);
    await appRepo.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/extra",
        title: "PM",
        company: "Gamma",
        appliedAt: "2026-06-03",
      }),
    );

    const result = importSql(db, sql, "upsert");
    expect(result.imported.applications).toBe(1);
    expect(result.applications).toHaveLength(2);
  });

  test("rejects malicious SQL containing ATTACH", () => {
    const db = openDatabase(":memory:");
    expect(() =>
      importSql(
        db,
        `ATTACH DATABASE '/tmp/evil.db' AS evil; INSERT INTO applications (id, url, applied_at, status, created_at, updated_at) VALUES ('x', 'https://example.com', '2026-06-01', 'applied', '2026-06-01', '2026-06-01');`,
        "replace",
      ),
    ).toThrow("forbidden");
  });

  test("rejects malicious SQL containing DROP TABLE outside backup format", () => {
    const db = openDatabase(":memory:");
    expect(() => importSql(db, "DROP TABLE applications;", "replace")).toThrow("unsupported");
  });

  test("upsert import preserves original created_at on conflict", async () => {
    const db = openDatabase(":memory:");
    const original = await seedSampleData(db);
    const exported = exportJson(db);

    const updatedExport = {
      ...exported,
      applications: exported.applications.map((application) =>
        application.id === original.id
          ? { ...application, company: "Acme Updated", createdAt: "2020-01-01T00:00:00.000Z" }
          : application,
      ),
    };

    const result = importJson(db, updatedExport, "upsert");
    const updated = result.applications.find((application) => application.id === original.id);
    expect(updated?.company).toBe("Acme Updated");
    expect(updated?.createdAt).toBe(original.createdAt);
  });

  test("exports and imports archived flag", async () => {
    const db = openDatabase(":memory:");
    const appRepo = new SqliteJobApplicationRepository(db);
    const application = await appRepo.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/archived",
        title: "Archived",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "rejected",
        archived: true,
      }),
    );

    const exported = exportJson(db);
    expect(exported.applications[0]?.archived).toBe(true);

    const freshDb = openDatabase(":memory:");
    const result = importJson(freshDb, exported, "replace");
    expect(result.applications[0]?.id).toBe(application.id);
    expect(result.applications[0]?.archived).toBe(true);
  });

  test("exports omit app access tokens", async () => {
    const db = openDatabase(":memory:");
    await seedSampleData(db);
    const repository = new SqliteAppAccessConfigRepository(db);
    const token = repository.ensureToken();

    const exportedJson = exportJson(db);
    const exportedSql = exportSql(db);

    expect(JSON.stringify(exportedJson)).not.toContain(token);
    expect(exportedSql).not.toContain(token);
    expect(exportedSql).not.toContain("app_access_config");
  });

  test("stripSensitiveDataFromDatabase removes stored app access token from a database file", () => {
    const dbPath = join(tmpdir(), `applied-backup-strip-${randomUUID()}.db`);
    const db = openDatabase(dbPath);
    const repository = new SqliteAppAccessConfigRepository(db);
    repository.ensureToken();
    db.close();

    stripSensitiveDataFromDatabase(dbPath);

    const reopened = openDatabase(dbPath);
    expect(new SqliteAppAccessConfigRepository(reopened).getToken()).toBeNull();
    reopened.close();
    rmSync(dbPath, { force: true });
  });
});

async function appRepoCreateSecond(db: ReturnType<typeof openDatabase>) {
  const appRepo = new SqliteJobApplicationRepository(db);
  await appRepo.create(
    createJobApplicationSchema.parse({
      url: "https://jobs.example.com/extra",
      title: "PM",
      company: "Gamma",
      appliedAt: "2026-06-03",
    }),
  );
}

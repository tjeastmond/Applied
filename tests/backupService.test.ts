import { describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteApplicationNoteRepository } from "@/lib/server/db/sqliteApplicationNoteRepository";
import { SqliteJobApplicationRepository } from "@/lib/server/db/sqliteRepository";
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

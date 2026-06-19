import { describe, expect, test, vi } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteJobApplicationRepository } from "@/lib/server/db/sqliteRepository";

describe("SqliteJobApplicationRepository", () => {
  test("creates, lists, updates, and deletes applications with extended fields", async () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteJobApplicationRepository(db);

    const created = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/role",
        linkedinUrl: "https://linkedin.com/company/acme",
        title: "Senior Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
        viaRecruiter: true,
        recruiterName: "Jane Doe",
        recruiterFirm: "TechRecruit LLC",
        contactEmail: "jane@acme.com",
        contactPhone: "555-1234",
        salaryRange: "$150k–$180k",
        desiredSalary: "$175k",
        fullJd: "<p><strong>Summary</strong> Great role.</p>",
        status: "applied",
      }),
    );

    expect(created.id).toBeTruthy();
    expect(created.viaRecruiter).toBe(true);
    expect(created.linkedinUrl).toBe("https://linkedin.com/company/acme");
    expect(created.salaryRange).toBe("$150k–$180k");
    expect(created.desiredSalary).toBe("$175k");
    expect(created.fullJd).toContain("Summary");

    const listed = await repository.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.title).toBe("Senior Engineer");

    const updated = await repository.update(created.id, {
      status: "interviewing",
      viaRecruiter: false,
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("interviewing");
    expect(updated?.viaRecruiter).toBe(false);
    expect(updated?.recruiterName).toBeNull();

    const deleted = await repository.delete(created.id);
    expect(deleted).toBe(true);
    expect(await repository.list()).toHaveLength(0);
  });

  test("lists applications by updatedAt then createdAt descending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T10:00:00.000Z"));

    const db = openDatabase(":memory:");
    const repository = new SqliteJobApplicationRepository(db);

    const older = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/older",
        title: "Older",
        company: "Acme",
        appliedAt: "2026-06-01",
      }),
    );

    vi.setSystemTime(new Date("2026-06-02T10:00:00.000Z"));

    const newer = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/newer",
        title: "Newer",
        company: "Beta",
        appliedAt: "2026-06-02",
      }),
    );

    vi.setSystemTime(new Date("2026-06-03T10:00:00.000Z"));
    await repository.update(older.id, { title: "Older touched" });

    const listed = await repository.list();
    expect(listed.map((item) => item.id)).toEqual([older.id, newer.id]);

    vi.useRealTimers();
  });

  test("listByIds returns only requested applications", async () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteJobApplicationRepository(db);

    const first = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/first",
        title: "First",
        company: "Acme",
        appliedAt: "2026-06-01",
      }),
    );
    const second = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/second",
        title: "Second",
        company: "Beta",
        appliedAt: "2026-06-02",
      }),
    );

    const listed = await repository.listByIds([second.id, first.id, second.id]);
    expect(listed.map((item) => item.id)).toEqual([second.id, first.id]);
  });

  test("listByIds returns empty array for empty ids", async () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteJobApplicationRepository(db);

    await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/only",
        title: "Only",
        company: "Acme",
        appliedAt: "2026-06-01",
      }),
    );

    expect(await repository.listByIds([])).toEqual([]);
  });

  test("defaults archived to false and supports archive toggles", async () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteJobApplicationRepository(db);

    const created = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/role",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "rejected",
      }),
    );

    expect(created.archived).toBe(false);

    const archived = await repository.update(created.id, { archived: true });
    expect(archived?.archived).toBe(true);
  });

  test("bulkArchiveByStatuses archives only matching non-archived applications", async () => {
    const db = openDatabase(":memory:");
    const repository = new SqliteJobApplicationRepository(db);

    const rejected = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/rejected",
        title: "Rejected",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "rejected",
      }),
    );
    const passed = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/passed",
        title: "Passed",
        company: "Beta",
        appliedAt: "2026-06-02",
        status: "passed",
      }),
    );
    const active = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/active",
        title: "Active",
        company: "Gamma",
        appliedAt: "2026-06-03",
        status: "applied",
      }),
    );
    await repository.update(rejected.id, { archived: true });
    const freshRejected = await repository.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/rejected-2",
        title: "Rejected 2",
        company: "Delta",
        appliedAt: "2026-06-04",
        status: "rejected",
      }),
    );

    const result = await repository.bulkArchiveByStatuses(["rejected", "passed"]);

    expect(result.archivedCount).toBe(2);
    expect(result.applications.find((item) => item.id === freshRejected.id)?.archived).toBe(true);
    expect(result.applications.find((item) => item.id === passed.id)?.archived).toBe(true);
    expect(result.applications.find((item) => item.id === rejected.id)?.archived).toBe(true);
    expect(result.applications.find((item) => item.id === active.id)?.archived).toBe(false);
  });
});

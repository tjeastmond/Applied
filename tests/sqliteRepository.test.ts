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
        fullJd: "<p><strong>Summary</strong> Great role.</p>",
        status: "applied",
      }),
    );

    expect(created.id).toBeTruthy();
    expect(created.viaRecruiter).toBe(true);
    expect(created.linkedinUrl).toBe("https://linkedin.com/company/acme");
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
});

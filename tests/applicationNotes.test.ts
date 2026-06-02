import { describe, expect, test } from "vitest";
import { migrateLegacyApplicationNotes, openDatabase } from "@/lib/server/db/migrate";
import { SqliteApplicationNoteRepository } from "@/lib/server/db/sqliteApplicationNoteRepository";
import { SqliteJobApplicationRepository } from "@/lib/server/db/sqliteRepository";

describe("SqliteApplicationNoteRepository", () => {
  test("appends multiple notes per application and cascades on delete", async () => {
    const db = openDatabase(":memory:");
    const applications = new SqliteJobApplicationRepository(db);
    const notes = new SqliteApplicationNoteRepository(db);

    const application = await applications.create({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
    });

    const first = await notes.create(application.id, "First round next week.");
    const second = await notes.create(application.id, "Phone screen scheduled.");

    expect(first.applicationId).toBe(application.id);
    expect(second.applicationId).toBe(application.id);

    const listed = await notes.listByApplicationId(application.id);
    expect(listed).toHaveLength(2);
    expect(listed.map((n) => n.content).sort()).toEqual(
      ["First round next week.", "Phone screen scheduled."].sort(),
    );

    await applications.delete(application.id);
    expect(await notes.listByApplicationId(application.id)).toHaveLength(0);
  });

  test("migrates legacy application notes column into application_notes", async () => {
    const db = openDatabase(":memory:");
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    db.prepare(
      `INSERT INTO applications (
        id, url, title, company, applied_at, via_recruiter, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 'applied', ?, ?)`,
    ).run(id, "https://example.com/job", "Role", "Co", "2026-06-01", "Legacy note text", timestamp, timestamp);

    migrateLegacyApplicationNotes(db);

    const noteRepo = new SqliteApplicationNoteRepository(db);
    const listed = await noteRepo.listByApplicationId(id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.content).toBe("Legacy note text");

    const row = db.prepare(`SELECT notes FROM applications WHERE id = ?`).get(id) as { notes: string | null };
    expect(row.notes).toBeNull();
  });
});

import { beforeEach, describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { loadInitialPageData } from "@/lib/server/loadInitialPageData";
import { getNoteRepository, getRepository, useTestDatabase } from "@/lib/server/db";
import { openDatabase } from "@/lib/server/db/migrate";

describe("loadInitialPageData", () => {
  beforeEach(() => {
    useTestDatabase(openDatabase(":memory:"));
  });

  test("returns applications and notes grouped by application id", async () => {
    const applications = getRepository();
    const notes = getNoteRepository();

    const firstApplication = await applications.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/one",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
      }),
    );
    const secondApplication = await applications.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/two",
        title: "Designer",
        company: "Beta",
        appliedAt: "2026-06-02",
      }),
    );

    const earlierNote = await notes.create(secondApplication.id, "Earlier note.");
    const latestNote = await notes.create(secondApplication.id, "Latest note.");

    const data = await loadInitialPageData();

    expect(data.applications).toHaveLength(2);
    expect(data.applications.map((application) => application.id).sort()).toEqual(
      [firstApplication.id, secondApplication.id].sort(),
    );
    expect(data.notesByApplicationId[secondApplication.id]?.map((note) => note.id)).toEqual([
      latestNote.id,
      earlierNote.id,
    ]);
    expect(data.notesByApplicationId[firstApplication.id]).toEqual([]);
  });
});

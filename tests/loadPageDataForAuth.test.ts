import { beforeEach, describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { getNoteRepository, getRepository, useTestDatabase } from "@/lib/server/db";
import { openDatabase } from "@/lib/server/db/migrate";
import { loadPageDataForAuth } from "@/lib/server/loadPageDataForAuth";

describe("loadPageDataForAuth", () => {
  beforeEach(() => {
    useTestDatabase(openDatabase(":memory:"));
  });

  test("returns empty data when unauthenticated", async () => {
    const data = await loadPageDataForAuth(false);

    expect(data.applications).toEqual([]);
    expect(data.notesByApplicationId).toEqual({});
  });

  test("loads applications and notes when authenticated", async () => {
    const applications = getRepository();
    const notes = getNoteRepository();

    const application = await applications.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/one",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
      }),
    );
    await notes.create(application.id, "Follow up.");

    const data = await loadPageDataForAuth(true);

    expect(data.applications).toHaveLength(1);
    expect(data.applications[0]?.id).toBe(application.id);
    expect(data.notesByApplicationId[application.id]).toHaveLength(1);
  });
});

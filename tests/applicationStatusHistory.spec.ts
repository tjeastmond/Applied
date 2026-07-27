import { describe, expect, test } from "vitest";
import { DEFAULT_USER_DISPLAY_NAME } from "@/lib/server/defaultUser";
import { migrate, openDatabase } from "@/lib/server/db/migrate";
import { useTestDatabase, getRepository, getStatusHistoryRepository, getUserRepository } from "@/lib/server/db";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { recordApplicationStatusChange } from "@/lib/server/services/applicationStatusHistoryService";

describe("application status history", () => {
  test("migration backfills initial status for existing applications", async () => {
    const db = openDatabase(":memory:");
    db.prepare(
      `INSERT INTO applications (
        id, url, title, company, applied_at, via_recruiter, status, archived, pinned, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, ?, ?)`,
    ).run(
      "00000000-0000-4000-a000-000000000010",
      "https://jobs.example.com/legacy",
      "Engineer",
      "Acme",
      "2026-01-01",
      "waiting",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );
    migrate(db);
    useTestDatabase(db);

    const history = await getStatusHistoryRepository().listByApplicationId("00000000-0000-4000-a000-000000000010");
    expect(history).toHaveLength(1);
    expect(history[0]?.fromStatus).toBeNull();
    expect(history[0]?.toStatus).toBe("waiting");
    expect(history[0]?.userDisplayName).toBe(DEFAULT_USER_DISPLAY_NAME);
  });

  test("records user and application on each status change", async () => {
    useTestDatabase(openDatabase(":memory:"));

    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/track",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-02",
        status: "applied",
      }),
    );

    const user = await getUserRepository().ensureDefaultUser();

    await recordApplicationStatusChange({
      applicationId: app.id,
      fromStatus: "applied",
      toStatus: "rejected",
      userId: user.id,
    });

    const history = await getStatusHistoryRepository().listByApplicationId(app.id);
    expect(history[0]).toMatchObject({
      applicationId: app.id,
      userId: user.id,
      fromStatus: "applied",
      toStatus: "rejected",
      userDisplayName: DEFAULT_USER_DISPLAY_NAME,
    });
  });

  test("repository create records initial status history", async () => {
    useTestDatabase(openDatabase(":memory:"));

    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/create-history",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-02",
        status: "to_apply",
      }),
    );

    const history = await getStatusHistoryRepository().listByApplicationId(app.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.fromStatus).toBeNull();
    expect(history[0]?.toStatus).toBe("to_apply");
  });
});

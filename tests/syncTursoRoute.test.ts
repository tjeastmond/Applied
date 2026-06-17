import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as syncTurso } from "@/app/api/backup/sync-turso/route";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { getRepository, useTestDatabase } from "@/lib/server/db";
import { openDatabase } from "@/lib/server/db/migrate";
import * as databaseTransferService from "@/lib/server/services/databaseTransferService";
import { authorizedAppRequest, restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("POST /api/backup/sync-turso", () => {
  beforeEach(() => {
    withTestAppAccessToken();
    useTestDatabase(openDatabase(":memory:"));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
  });

  test("returns 403 when turso sync is unavailable", async () => {
    vi.spyOn(databaseTransferService, "isTursoSyncAvailable").mockReturnValue(false);

    const response = await syncTurso(
      authorizedAppRequest("/api/backup/sync-turso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "upsert" }),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("pushes sqlite data to turso when available", async () => {
    vi.spyOn(databaseTransferService, "isTursoSyncAvailable").mockReturnValue(true);
    vi.spyOn(databaseTransferService, "pushSqliteToTurso").mockResolvedValue({
      imported: { applications: 1, notes: 2 },
      verification: {
        source: { applicationCount: 1, noteCount: 2, latestUpdatedAt: "2026-06-01T00:00:00.000Z" },
        target: { applicationCount: 1, noteCount: 2, latestUpdatedAt: "2026-06-01T00:00:00.000Z" },
        matches: true,
        differences: [],
      },
    });

    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/sync",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
      }),
    );

    const response = await syncTurso(
      authorizedAppRequest("/api/backup/sync-turso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "upsert" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      imported: { applications: 1, notes: 2 },
      matches: true,
      differences: [],
    });
    expect(databaseTransferService.pushSqliteToTurso).toHaveBeenCalledWith({ mode: "upsert" });
  });
});

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { GET as getDatabaseBackup } from "@/app/api/backup/database/route";
import { GET as exportBackup } from "@/app/api/backup/export/route";
import { POST as importBackup } from "@/app/api/backup/import/route";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { getRepository, useTestDatabase } from "@/lib/server/db";
import { openDatabase } from "@/lib/server/db/migrate";
import { authorizedAppRequest, emptyRouteContext, restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("backup API routes", () => {
  beforeEach(() => {
    withTestAppAccessToken();
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
  });

  test("rejects unauthenticated backup export", async () => {
    const response = await exportBackup(
      new Request("http://localhost/api/backup/export?format=json"),
      emptyRouteContext,
    );
    expect(response.status).toBe(401);
  });

  test("exports JSON through the selected backend", async () => {
    await seedApplication();

    const response = await exportBackup(authorizedAppRequest("/api/backup/export?format=json"), emptyRouteContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as { applications: { company: string | null }[] };
    expect(body.applications).toHaveLength(1);
    expect(body.applications[0]?.company).toBe("Acme");
  });

  test("imports JSON through the selected backend", async () => {
    await seedApplication();
    const exportResponse = await exportBackup(
      authorizedAppRequest("/api/backup/export?format=json"),
      emptyRouteContext,
    );
    const backup = await exportResponse.text();

    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/extra",
        title: "Extra",
        company: "Beta",
        appliedAt: "2026-06-02",
      }),
    );

    const formData = new FormData();
    formData.set("mode", "replace");
    formData.set("file", new File([backup], "backup.json", { type: "application/json" }));

    const response = await importBackup(
      authorizedAppRequest("/api/backup/import", {
        method: "POST",
        body: formData,
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { applications: { company: string | null }[] };
    expect(body.applications).toHaveLength(1);
    expect(body.applications[0]?.company).toBe("Acme");
  });

  test("creates a database backup through the selected backend", async () => {
    await seedApplication();

    const response = await getDatabaseBackup(authorizedAppRequest("/api/backup/database"), emptyRouteContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain(".zip");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});

async function seedApplication() {
  return getRepository().create(
    createJobApplicationSchema.parse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
    }),
  );
}

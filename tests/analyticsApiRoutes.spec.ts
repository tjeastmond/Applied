import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as getAnalytics } from "@/app/api/analytics/route";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { openDatabase } from "@/lib/server/db/migrate";
import { getDatabaseBackend, getRepository, useTestDatabase } from "@/lib/server/db";
import { authorizedAppRequest, emptyRouteContext, restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

function utcDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function createApplication(company: string, status: "applied" | "offer", archived = false, daysAgo = 0) {
  return getRepository().create(
    createJobApplicationSchema.parse({
      url: `https://jobs.example.com/${crypto.randomUUID()}`,
      title: "Engineer",
      company,
      appliedAt: utcDateOffset(-daysAgo),
      status,
      archived,
    }),
  );
}

describe("analytics API route", () => {
  beforeEach(() => {
    withTestAppAccessToken();
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    restoreAppAccessToken(originalAppAccessToken);
  });

  test("requires app authentication", async () => {
    const response = await getAnalytics(new Request("http://localhost/api/analytics"), emptyRouteContext);

    expect(response.status).toBe(401);
  });

  test("recreates a cached backend that predates the analytics repository", async () => {
    vi.stubEnv("DATABASE_PROVIDER", "sqlite");
    vi.stubEnv("DATABASE_PATH", ":memory:");
    const staleBackend = getDatabaseBackend();
    expect(Reflect.deleteProperty(staleBackend as unknown as Record<string, unknown>, "analytics")).toBe(true);

    const response = await getAnalytics(authorizedAppRequest("/api/analytics"), emptyRouteContext);

    expect(response.status).toBe(200);
    expect(getDatabaseBackend().analytics).toHaveProperty("loadSnapshot");
  });

  test.each([
    ["/api/analytics?range=custom", "is required for a custom range"],
    ["/api/analytics?range=custom&from=2026-08-12&to=2026-08-01", "must be on or before to"],
    ["/api/analytics?range=custom&from=2026-02-31&to=2026-03-01", "must be a valid date"],
    ["/api/analytics?archived=yes", "archived: must be 0 or 1"],
    ["/api/analytics?status=unknown", "Invalid option"],
  ])("rejects invalid analytics query %s", async (path, expectedError) => {
    const response = await getAnalytics(authorizedAppRequest(path), emptyRouteContext);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain(expectedError);
  });

  test("returns the default 90-day analytics contract", async () => {
    await createApplication("Recent", "applied");
    await createApplication("Old", "offer", false, 100);

    const response = await getAnalytics(authorizedAppRequest("/api/analytics"), emptyRouteContext);
    const body = (await response.json()) as {
      allTimeApplicationCount: number;
      cohort: { applications: number };
      status: unknown[];
      sparse: boolean;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      allTimeApplicationCount: 2,
      cohort: { applications: 1 },
      sparse: true,
    });
    expect(body.status).toHaveLength(8);
  });

  test("supports repeated filters and includes archived unless archived=0", async () => {
    await createApplication("Acme", "applied", true);
    await createApplication("Beta", "offer");
    await createApplication("Other", "applied");

    const repeated = await getAnalytics(
      authorizedAppRequest("/api/analytics?company=Acme&company=Beta&status=applied&status=offer"),
      emptyRouteContext,
    );
    const repeatedBody = (await repeated.json()) as { cohort: { applications: number }; companies: unknown[] };

    expect(repeated.status).toBe(200);
    expect(repeatedBody.cohort.applications).toBe(2);
    expect(repeatedBody.companies).toHaveLength(2);

    const activeOnly = await getAnalytics(
      authorizedAppRequest("/api/analytics?company=Acme&company=Beta&status=applied&status=offer&archived=0"),
      emptyRouteContext,
    );
    const activeOnlyBody = (await activeOnly.json()) as { cohort: { applications: number } };
    expect(activeOnlyBody.cohort.applications).toBe(1);
  });
});

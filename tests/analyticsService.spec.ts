import { describe, expect, test } from "vitest";
import { APPLICATION_STATUS_OPTIONS, type ApplicationStatus } from "@/lib/applicationStatus";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteDatabaseBackend } from "@/lib/server/db/sqliteBackend";
import { buildAnalytics } from "@/lib/server/services/analyticsService";

const NOW = new Date("2026-08-12T12:00:00.000Z");

type CreateAnalyticsApplication = {
  appliedAt: string;
  company?: string | null;
  status?: ApplicationStatus;
  archived?: boolean;
  createdAt?: string;
};

function setup() {
  const db = openDatabase(":memory:");
  const backend = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, db);

  async function create(input: CreateAnalyticsApplication) {
    const application = await backend.applications.create(
      createJobApplicationSchema.parse({
        url: `https://jobs.example.com/${crypto.randomUUID()}`,
        title: "Engineer",
        company: input.company ?? "Acme",
        appliedAt: input.appliedAt,
        status: input.status ?? "applied",
        archived: input.archived ?? false,
      }),
    );
    const createdAt = input.createdAt ?? `${input.appliedAt}T12:00:00.000Z`;
    db.prepare(`UPDATE applications SET created_at = ?, updated_at = ? WHERE id = ?`).run(
      createdAt,
      createdAt,
      application.id,
    );
    db.prepare(`UPDATE application_status_history SET changed_at = ? WHERE application_id = ?`).run(
      createdAt,
      application.id,
    );
    if (input.company === null) {
      db.prepare(`UPDATE applications SET company = NULL WHERE id = ?`).run(application.id);
    }
    return application;
  }

  return { backend, create, db };
}

function defaultQuery() {
  return {
    range: "custom" as const,
    from: "2026-08-01",
    to: "2026-08-03",
    companies: [],
    statuses: [],
    includeArchived: true,
  };
}

describe("analytics service", () => {
  test("emits 30 daily buckets while longer standard ranges use coarser cadences", async () => {
    const { backend, create } = setup();
    await create({ appliedAt: "2026-08-12" });

    const last30Days = await buildAnalytics(
      { range: "30d", companies: [], statuses: [], includeArchived: true },
      backend.analytics,
      NOW,
    );
    const last90Days = await buildAnalytics(
      { range: "90d", companies: [], statuses: [], includeArchived: true },
      backend.analytics,
      NOW,
    );
    const last6Months = await buildAnalytics(
      { range: "6m", companies: [], statuses: [], includeArchived: true },
      backend.analytics,
      NOW,
    );
    const last12Months = await buildAnalytics(
      { range: "12m", companies: [], statuses: [], includeArchived: true },
      backend.analytics,
      NOW,
    );

    expect(last30Days.volume).toHaveLength(30);
    expect(last30Days.volume[0]).toMatchObject({ bucketStart: "2026-07-14", bucketEnd: "2026-07-14" });
    expect(last30Days.volume.at(-1)).toMatchObject({ bucketStart: "2026-08-12", bucketEnd: "2026-08-12" });
    expect(last90Days.volume).toHaveLength(14);
    expect(last90Days.volume[0]).toMatchObject({ bucketStart: "2026-05-11", bucketEnd: "2026-05-17" });
    expect(last6Months.volume).toHaveLength(7);
    expect(last6Months.volume[0]).toMatchObject({ bucketStart: "2026-02-01", bucketEnd: "2026-02-28" });
    expect(last12Months.volume).toHaveLength(13);
    expect(last12Months.volume[0]).toMatchObject({ bucketStart: "2025-08-01", bucketEnd: "2025-08-31" });
  });

  test("uses inclusive date boundaries, emits zero buckets, and preserves status option order", async () => {
    const { backend, create } = setup();
    await create({ appliedAt: "2026-07-31" });
    await create({ appliedAt: "2026-08-01", status: "applied" });
    await create({ appliedAt: "2026-08-03", status: "offer" });
    await create({ appliedAt: "2026-08-04" });

    const result = await buildAnalytics(defaultQuery(), backend.analytics, NOW);

    expect(result.allTimeApplicationCount).toBe(4);
    expect(result.cohort.applications).toBe(2);
    expect(result.volume).toEqual([
      { bucketStart: "2026-08-01", bucketEnd: "2026-08-01", label: "Aug 1", count: 1 },
      { bucketStart: "2026-08-02", bucketEnd: "2026-08-02", label: "Aug 2", count: 0 },
      { bucketStart: "2026-08-03", bucketEnd: "2026-08-03", label: "Aug 3", count: 1 },
    ]);
    expect(result.status.map(({ status }) => status)).toEqual(APPLICATION_STATUS_OPTIONS.map(({ value }) => value));
    expect(result.status.find(({ status }) => status === "waiting")).toMatchObject({
      count: 0,
      percentage: 0,
    });
  });

  test("includes archived by default and applies archived, company, and current-status filters", async () => {
    const { backend, create } = setup();
    await create({ appliedAt: "2026-08-01", company: "Acme", status: "applied", archived: true });
    await create({ appliedAt: "2026-08-02", company: "Acme", status: "rejected" });
    await create({ appliedAt: "2026-08-03", company: "Beta", status: "applied" });

    const included = await buildAnalytics(defaultQuery(), backend.analytics, NOW);
    expect(included.cohort.applications).toBe(3);

    const filtered = await buildAnalytics(
      {
        ...defaultQuery(),
        companies: ["Acme"],
        statuses: ["applied"],
        includeArchived: false,
      },
      backend.analytics,
      NOW,
    );
    expect(filtered.cohort.applications).toBe(0);
    expect(filtered.rates).toEqual({ activePipeline: null, interview: null, offer: null });
  });

  test("derives conversion from history, treats offers as interviews, and groups unknown companies", async () => {
    const { backend, create, db } = setup();
    const interviewed = await create({ appliedAt: "2026-08-01", company: "Acme", status: "rejected" });
    const offered = await create({ appliedAt: "2026-08-02", company: "Acme", status: "rejected" });
    await create({ appliedAt: "2026-08-03", company: null, status: "to_apply" });

    const user = await backend.users.ensureDefaultUser();
    await backend.statusHistory.record({
      applicationId: interviewed.id,
      userId: user.id,
      fromStatus: "applied",
      toStatus: "interviewing",
      changedAt: "2026-08-01T13:00:00.000Z",
    });
    await backend.statusHistory.record({
      applicationId: offered.id,
      userId: user.id,
      fromStatus: "applied",
      toStatus: "offer",
      changedAt: "2026-08-02T13:00:00.000Z",
    });

    const result = await buildAnalytics(defaultQuery(), backend.analytics, NOW);

    expect(result.cohort).toMatchObject({ applications: 3, eligible: 2, interviewed: 2, offers: 1 });
    expect(result.rates).toMatchObject({ interview: 100, offer: 50 });
    expect(result.companies[0]).toMatchObject({
      company: "Acme",
      applications: 2,
      interviewed: 2,
      offers: 1,
      interviewRate: 100,
    });
    expect(result.companies.find(({ company }) => company === "Unknown Company")).toBeDefined();
    expect(result.sparse).toBe(true);

    const offeredHistory = db
      .prepare(`SELECT to_status FROM application_status_history WHERE application_id = ? ORDER BY changed_at`)
      .all(offered.id) as { to_status: string }[];
    expect(offeredHistory.map(({ to_status }) => to_status)).not.toContain("interviewing");
  });

  test("flags ambiguous synthetic history and returns null conversion rates with no eligible apps", async () => {
    const { backend, create } = setup();
    await create({
      appliedAt: "2026-08-01",
      status: "rejected",
      createdAt: "2026-08-01T12:00:00.000Z",
    });
    await create({ appliedAt: "2026-08-02", status: "to_apply" });
    for (const day of ["2026-08-03", "2026-08-03", "2026-08-03", "2026-08-03"]) {
      await create({ appliedAt: day, status: "applied" });
    }

    const result = await buildAnalytics(defaultQuery(), backend.analytics, NOW);
    expect(result.historyIncomplete).toBe(true);
    expect(result.sparse).toBe(false);

    const noEligible = await buildAnalytics({ ...defaultQuery(), statuses: ["to_apply"] }, backend.analytics, NOW);
    expect(noEligible.cohort.eligible).toBe(0);
    expect(noEligible.rates.interview).toBeNull();
    expect(noEligible.rates.offer).toBeNull();
    expect(noEligible.sparse).toBe(true);
  });

  test("uses Monday weekly buckets and monthly all-time buckets for long spans", async () => {
    const { backend, create } = setup();
    await create({ appliedAt: "2025-01-15" });
    await create({ appliedAt: "2026-08-12" });

    const weekly = await buildAnalytics(
      {
        range: "custom",
        from: "2026-06-01",
        to: "2026-08-12",
        companies: [],
        statuses: [],
        includeArchived: true,
      },
      backend.analytics,
      NOW,
    );
    expect(weekly.volume[0]?.bucketStart).toBe("2026-06-01");
    expect(weekly.volume[1]).toMatchObject({ bucketStart: "2026-06-08", count: 0 });

    const allTime = await buildAnalytics(
      { range: "all", companies: [], statuses: [], includeArchived: true },
      backend.analytics,
      NOW,
    );
    expect(allTime.volume[0]).toMatchObject({
      bucketStart: "2025-01-01",
      bucketEnd: "2025-01-31",
      label: "Jan 2025",
    });
    expect(allTime.volume.at(-1)?.bucketStart).toBe("2026-08-01");
  });
});

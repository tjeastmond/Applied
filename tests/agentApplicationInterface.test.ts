import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { getRepository, useTestDatabase } from "@/lib/server/db";
import { openDatabase } from "@/lib/server/db/migrate";
import {
  createApplicationFromUrlForAgent,
  listApplicationsForAgent,
} from "@/lib/server/services/agentApplicationInterface";
import { parseJobUrl } from "@/lib/server/services/parseJobUrl";

vi.mock("@/lib/server/services/parseJobUrl", () => ({
  parseJobUrl: vi.fn(),
}));

const mockedParseJobUrl = vi.mocked(parseJobUrl);

describe("agent application interface", () => {
  beforeEach(() => {
    useTestDatabase(openDatabase(":memory:"));
    mockedParseJobUrl.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("lists only agent-safe application summaries", async () => {
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/role",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
        contactEmail: "person@example.com",
        fullJd: "<p>Private job description</p>",
        status: "to_apply",
      }),
    );

    const applications = await listApplicationsForAgent();

    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      url: "https://jobs.example.com/role",
      status: "to_apply",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
    });
    expect(applications[0]).not.toHaveProperty("contactEmail");
    expect(applications[0]).not.toHaveProperty("fullJd");
  });

  test("filters listed applications by search query", async () => {
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/backend",
        title: "Backend Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/design",
        title: "Product Designer",
        company: "Globex",
        appliedAt: "2026-06-02",
        status: "interviewing",
      }),
    );

    const applications = await listApplicationsForAgent("interviewing");

    expect(applications).toHaveLength(1);
    expect(applications[0]?.title).toBe("Product Designer");
  });

  test("excludes archived applications from agent list", async () => {
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/active",
        title: "Active",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );
    const archived = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/archived",
        title: "Archived",
        company: "Beta",
        appliedAt: "2026-06-02",
        status: "rejected",
      }),
    );
    await getRepository().update(archived.id, { archived: true });

    const applications = await listApplicationsForAgent();

    expect(applications).toHaveLength(1);
    expect(applications[0]?.title).toBe("Active");
  });

  test("creates an application from a parsed job URL with to_apply status", async () => {
    mockedParseJobUrl.mockResolvedValue({
      ok: true,
      title: "Founding Engineer",
      company: "Acme",
      salaryRange: null,
      fullJd: "<p>Build things.</p>",
    });

    const result = await createApplicationFromUrlForAgent("jobs.example.com/role");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.application).toMatchObject({
      url: "https://jobs.example.com/role",
      status: "to_apply",
      title: "Founding Engineer",
      company: "Acme",
      appliedAt: "2026-06-10",
    });

    const [stored] = await getRepository().list();
    expect(stored?.status).toBe("to_apply");
    expect(stored?.fullJd).toBe("<p>Build things.</p>");
  });

  test("does not create an application when parsing misses required fields", async () => {
    mockedParseJobUrl.mockResolvedValue({
      ok: true,
      title: null,
      company: "Acme",
      salaryRange: null,
      fullJd: null,
    });

    const result = await createApplicationFromUrlForAgent("https://jobs.example.com/role");

    expect(result).toEqual({
      ok: false,
      error: "Parsed job URL must include a title and company",
    });
    expect(await getRepository().list()).toHaveLength(0);
  });
});

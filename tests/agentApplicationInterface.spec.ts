import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { getNoteRepository, getRepository, getStatusHistoryRepository, useTestDatabase } from "@/lib/server/db";
import { openDatabase } from "@/lib/server/db/migrate";
import {
  createApplicationFromUrlForAgent,
  createNoteForAgent,
  getApplicationForAgent,
  listApplicationsForAgent,
  listCompaniesForAgent,
  listNotesForAgent,
  updateApplicationStatusForAgent,
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

  test("creates an application from a parsed job URL with to_apply status by default", async () => {
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

    const notes = await getNoteRepository().listByApplicationId(result.application.id);
    expect(notes.some((note) => note.content === "Created by the CLI")).toBe(true);
  });

  test("creates an application with an explicit status override", async () => {
    mockedParseJobUrl.mockResolvedValue({
      ok: true,
      title: "Founding Engineer",
      company: "Acme",
      salaryRange: null,
      fullJd: null,
    });

    const result = await createApplicationFromUrlForAgent("https://jobs.example.com/role", "applied");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.application.status).toBe("applied");
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

  test("getApplicationForAgent returns null for archived applications", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/archived",
        title: "Archived",
        company: "Beta",
        appliedAt: "2026-06-02",
        status: "rejected",
      }),
    );
    await getRepository().update(app.id, { archived: true });

    expect(await getApplicationForAgent(app.id)).toBeNull();
  });

  test("updateApplicationStatusForAgent records note and history", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/status",
        title: "Status Role",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "to_apply",
      }),
    );

    const updated = await updateApplicationStatusForAgent(app.id, "applied");
    expect(updated?.status).toBe("applied");

    const notes = await getNoteRepository().listByApplicationId(app.id);
    expect(notes.some((note) => note.content === "Status Update: Applied")).toBe(true);
    expect(notes.some((note) => note.content === "Updated by the CLI")).toBe(true);

    const history = await getStatusHistoryRepository().listByApplicationId(app.id);
    expect(history.some((entry) => entry.fromStatus === "to_apply" && entry.toStatus === "applied")).toBe(true);
  });

  test("listCompaniesForAgent returns distinct sorted companies", async () => {
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/a",
        title: "A",
        company: "Globex",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/b",
        title: "B",
        company: "Acme",
        appliedAt: "2026-06-02",
        status: "applied",
      }),
    );

    expect(await listCompaniesForAgent()).toEqual(["Acme", "Globex"]);
    expect(await listCompaniesForAgent("glob")).toEqual(["Globex"]);
  });

  test("listNotesForAgent and createNoteForAgent work for visible applications", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/notes",
        title: "Notes Role",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );

    expect(await listNotesForAgent(app.id)).toEqual([]);

    const note = await createNoteForAgent(app.id, "Agent note");
    expect(note?.content).toBe("Agent note");

    const notes = await listNotesForAgent(app.id);
    expect(notes).toHaveLength(1);
    expect(notes?.[0]?.content).toBe("Agent note");
    expect(notes?.some((note) => note.content === "Updated by the CLI")).toBe(false);
  });
});

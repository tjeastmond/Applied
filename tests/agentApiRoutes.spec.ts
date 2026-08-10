import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { AGENT_REQUIRED_PATHS } from "@/lib/server/agentDiscovery";
import {
  getAgentApiTokenRepository,
  getNoteRepository,
  getRepository,
  getStatusHistoryRepository,
  useTestDatabase,
} from "@/lib/server/db";
import { openDatabase } from "@/lib/server/db/migrate";
import { GET as getAgentInfo } from "@/app/api/agent/route";
import { GET as getAgentDocs } from "@/app/api/agent/docs/route";
import { GET as getAgentCompanies } from "@/app/api/agent/companies/route";
import * as agentApplicationsRoute from "@/app/api/agent/applications/route";
import { GET as getAgentApplication, PATCH as patchAgentApplication } from "@/app/api/agent/applications/[id]/route";
import { GET as getAgentNotes, POST as postAgentNote } from "@/app/api/agent/applications/[id]/notes/route";
import { parseJobUrl } from "@/lib/server/services/parseJobUrl";

vi.mock("@/lib/server/services/parseJobUrl", () => ({
  parseJobUrl: vi.fn(),
}));

const mockedParseJobUrl = vi.mocked(parseJobUrl);
const originalAgentApiToken = process.env.AGENT_API_TOKEN;

function authorizedRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Authorization: "Bearer test-agent-token",
      ...init.headers,
    },
  });
}

describe("agent API routes", () => {
  beforeEach(() => {
    process.env.AGENT_API_TOKEN = "test-agent-token";
    useTestDatabase(openDatabase(":memory:"));
    mockedParseJobUrl.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
  });

  afterEach(() => {
    process.env.AGENT_API_TOKEN = originalAgentApiToken;
    vi.useRealTimers();
  });

  test("GET /api/agent rejects missing bearer token", async () => {
    const response = await getAgentInfo(new Request("http://localhost/api/agent"));
    expect(response.status).toBe(401);
  });

  test("GET /api/agent returns capabilities and limitations when authorized", async () => {
    const response = await getAgentInfo(authorizedRequest("/api/agent"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      version: number;
      authentication: { discoveryIsPublic: boolean; requiredFor: string[]; tokenSource: string };
      applicationSummaryFields: string[];
      statuses: string[];
      capabilities: { method: string; path: string }[];
      limitations: string[];
      errors: { codes: Record<string, string> };
      cli: { command: string };
      documentationUrl: string;
      openapiUrl: string;
      interactiveDocumentationUrl: string;
    };
    expect(body.version).toBe(2);
    expect(body.authentication).toMatchObject({
      discoveryIsPublic: false,
      requiredFor: [...AGENT_REQUIRED_PATHS],
      tokenSource: "env",
    });
    expect(body.documentationUrl).toBe("/api/agent/docs");
    expect(body.openapiUrl).toBe("/api/agent/openapi");
    expect(body.interactiveDocumentationUrl).toBe("/agent/docs");
    expect(body.cli.command).toBe("pnpm applied:agent");
    expect(body.applicationSummaryFields).toEqual([
      "id",
      "url",
      "status",
      "title",
      "company",
      "appliedAt",
      "updatedAt",
    ]);
    expect(body.statuses).toContain("to_apply");
    expect(body.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/agent/applications" }),
        expect.objectContaining({ method: "POST", path: "/api/agent/applications" }),
        expect.objectContaining({ method: "PATCH", path: "/api/agent/applications/:id" }),
        expect.objectContaining({ method: "GET", path: "/api/agent/companies" }),
        expect.objectContaining({ method: "GET", path: "/api/agent/docs" }),
      ]),
    );
    expect(typeof body.errors.codes["400"]).toBe("string");
    expect(typeof body.errors.codes["401"]).toBe("string");
    expect(typeof body.errors.codes["404"]).toBe("string");
    expect(typeof body.errors.codes["503"]).toBe("string");
    expect(body.limitations).toContain("No delete endpoint");
    expect(body.limitations).toContain(
      "No access to recruiter, contact, salary, or job-description fields in responses",
    );
  });

  test("GET /api/agent reports database tokenSource when only DB tokens are configured", async () => {
    delete process.env.AGENT_API_TOKEN;
    const repository = getAgentApiTokenRepository();
    expect(repository).not.toBeNull();
    const created = await Promise.resolve(repository!.create("DB Only"));

    const response = await getAgentInfo(
      new Request("http://localhost/api/agent", {
        headers: { Authorization: `Bearer ${created.token}` },
      }),
    );
    const body = (await response.json()) as { authentication: { tokenSource: string } };
    expect(body.authentication.tokenSource).toBe("database");
  });

  test("GET /api/agent/docs rejects missing bearer token", async () => {
    const response = await getAgentDocs(new Request("http://localhost/api/agent/docs"));
    expect(response.status).toBe(401);
  });

  test("GET /api/agent/docs returns markdown when authorized", async () => {
    const response = await getAgentDocs(authorizedRequest("/api/agent/docs"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    const markdown = await response.text();
    expect(markdown).toContain("pnpm applied:agent");
    expect(markdown).toContain("AGENT_API_TOKEN");
    expect(markdown).toContain("/api/agent/openapi");
    expect(markdown).toContain("/agent/docs");
  });

  test("GET /api/agent/applications rejects missing and invalid bearer tokens", async () => {
    const missingResponse = await agentApplicationsRoute.GET(new Request("http://localhost/api/agent/applications"));
    expect(missingResponse.status).toBe(401);

    const invalidResponse = await agentApplicationsRoute.GET(
      new Request("http://localhost/api/agent/applications", {
        headers: { Authorization: "Bearer wrong-token" },
      }),
    );
    expect(invalidResponse.status).toBe(401);
  });

  test("GET /api/agent/applications accepts database-backed bearer tokens", async () => {
    delete process.env.AGENT_API_TOKEN;
    const repository = getAgentApiTokenRepository();
    const created = await Promise.resolve(repository!.create("Route Test"));

    const response = await agentApplicationsRoute.GET(
      new Request("http://localhost/api/agent/applications", {
        headers: { Authorization: `Bearer ${created.token}` },
      }),
    );

    expect(response.status).toBe(200);
  });

  test("GET /api/agent/applications returns 503 when no agent tokens are configured", async () => {
    delete process.env.AGENT_API_TOKEN;

    const response = await agentApplicationsRoute.GET(new Request("http://localhost/api/agent/applications"));
    expect(response.status).toBe(503);
  });

  test("GET /api/agent/applications returns application summaries after auth", async () => {
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/listed",
        title: "Listed Role",
        company: "Acme",
        appliedAt: "2026-06-01",
        contactEmail: "person@example.com",
        fullJd: "<p>Hidden</p>",
        status: "to_apply",
      }),
    );

    const response = await agentApplicationsRoute.GET(authorizedRequest("/api/agent/applications"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { applications: Record<string, unknown>[] };
    expect(body.applications).toHaveLength(1);
    expect(body.applications[0]).toMatchObject({
      url: "https://jobs.example.com/listed",
      status: "to_apply",
      title: "Listed Role",
      company: "Acme",
      appliedAt: "2026-06-01",
    });
    expect(body.applications[0]).not.toHaveProperty("contactEmail");
    expect(body.applications[0]).not.toHaveProperty("fullJd");
  });

  test("GET /api/agent/applications filters results with search query", async () => {
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

    const response = await agentApplicationsRoute.GET(authorizedRequest("/api/agent/applications?search=globex"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { applications: { company: string }[] };
    expect(body.applications).toHaveLength(1);
    expect(body.applications[0]?.company).toBe("Globex");
  });

  test("POST /api/agent/applications defaults status to to_apply", async () => {
    mockedParseJobUrl.mockResolvedValue({
      ok: true,
      title: "Parsed Role",
      company: "Acme",
      salaryRange: null,
      fullJd: "<p>Parsed JD</p>",
    });

    const response = await agentApplicationsRoute.POST(
      authorizedRequest("/api/agent/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://jobs.example.com/parsed" }),
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; status: string };
    expect(body.status).toBe("to_apply");

    const notes = await getNoteRepository().listByApplicationId(body.id);
    expect(notes.some((note) => note.content === "Created by the CLI")).toBe(true);
  });

  test("POST /api/agent/applications honors submitted status", async () => {
    mockedParseJobUrl.mockResolvedValue({
      ok: true,
      title: "Parsed Role",
      company: "Acme",
      salaryRange: null,
      fullJd: null,
    });

    const response = await agentApplicationsRoute.POST(
      authorizedRequest("/api/agent/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://jobs.example.com/parsed",
          status: "applied",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("applied");
  });

  test("POST /api/agent/applications rejects invalid status", async () => {
    mockedParseJobUrl.mockResolvedValue({
      ok: true,
      title: "Parsed Role",
      company: "Acme",
      salaryRange: null,
      fullJd: null,
    });

    const response = await agentApplicationsRoute.POST(
      authorizedRequest("/api/agent/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://jobs.example.com/parsed",
          status: "not-a-status",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("GET /api/agent/applications/:id returns a single application", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/one",
        title: "One Role",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );

    const response = await getAgentApplication(authorizedRequest(`/api/agent/applications/${app.id}`), {
      params: Promise.resolve({ id: app.id }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; title: string };
    expect(body.id).toBe(app.id);
    expect(body.title).toBe("One Role");
  });

  test("GET /api/agent/applications/:id returns 404 for archived application", async () => {
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

    const response = await getAgentApplication(authorizedRequest(`/api/agent/applications/${app.id}`), {
      params: Promise.resolve({ id: app.id }),
    });

    expect(response.status).toBe(404);
  });

  test("PATCH /api/agent/applications/:id updates status with side effects", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/status",
        title: "Status Role",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "to_apply",
      }),
    );

    const response = await patchAgentApplication(
      authorizedRequest(`/api/agent/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "applied" }),
      }),
      { params: Promise.resolve({ id: app.id }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("applied");

    const notes = await getNoteRepository().listByApplicationId(app.id);
    expect(notes.some((note) => note.content === "Status Update: Applied")).toBe(true);
    expect(notes.some((note) => note.content === "Updated by the CLI")).toBe(true);

    const history = await getStatusHistoryRepository().listByApplicationId(app.id);
    expect(history.some((entry) => entry.fromStatus === "to_apply" && entry.toStatus === "applied")).toBe(true);
  });

  test("PATCH /api/agent/applications/:id returns 404 for archived application", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/archived-patch",
        title: "Archived",
        company: "Beta",
        appliedAt: "2026-06-02",
        status: "rejected",
      }),
    );
    await getRepository().update(app.id, { archived: true });

    const response = await patchAgentApplication(
      authorizedRequest(`/api/agent/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "applied" }),
      }),
      { params: Promise.resolve({ id: app.id }) },
    );

    expect(response.status).toBe(404);
  });

  test("agent notes GET and POST", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/notes",
        title: "Notes Role",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );
    const beforeUpdatedAt = app.updatedAt;

    const createResponse = await postAgentNote(
      authorizedRequest(`/api/agent/applications/${app.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Agent follow up" }),
      }),
      { params: Promise.resolve({ id: app.id }) },
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string; content: string; applicationUpdatedAt: string };
    expect(created.content).toBe("Agent follow up");
    expect(created.applicationUpdatedAt >= beforeUpdatedAt).toBe(true);

    const listResponse = await getAgentNotes(authorizedRequest(`/api/agent/applications/${app.id}/notes`), {
      params: Promise.resolve({ id: app.id }),
    });
    expect(listResponse.status).toBe(200);
    const body = (await listResponse.json()) as { notes: { content: string }[] };
    expect(body.notes).toHaveLength(1);
    expect(body.notes[0]?.content).toBe("Agent follow up");
  });

  test("GET /api/agent/companies returns distinct sorted companies", async () => {
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
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/c",
        title: "C",
        company: "Acme",
        appliedAt: "2026-06-03",
        status: "applied",
      }),
    );

    const response = await getAgentCompanies(authorizedRequest("/api/agent/companies"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { companies: string[] };
    expect(body.companies).toEqual(["Acme", "Globex"]);
  });

  test("GET /api/agent/companies filters by search", async () => {
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

    const response = await getAgentCompanies(authorizedRequest("/api/agent/companies?search=glob"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { companies: string[] };
    expect(body.companies).toEqual(["Globex"]);
  });

  test("agent applications collection route does not export forbidden mutations", () => {
    expect("PATCH" in agentApplicationsRoute).toBe(false);
    expect("DELETE" in agentApplicationsRoute).toBe(false);
  });
});

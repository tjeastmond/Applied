import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { getAgentApiTokenRepository, getRepository, useTestDatabase } from "@/lib/server/db";
import { openDatabase } from "@/lib/server/db/migrate";
import { GET as getAgentInfo } from "@/app/api/agent/route";
import * as agentApplicationsRoute from "@/app/api/agent/applications/route";
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

  test("GET /api/agent returns capabilities and limitations", async () => {
    const response = await getAgentInfo();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      authentication: { discoveryIsPublic: boolean; requiredFor: string[]; tokenSource: string };
      applicationSummaryFields: string[];
      statuses: string[];
      capabilities: { method: string; path: string; response: unknown }[];
      limitations: string[];
      errors: { codes: Record<string, string> };
    };
    expect(body.authentication).toMatchObject({
      discoveryIsPublic: true,
      requiredFor: ["/api/agent/applications"],
      tokenSource: "env",
    });
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
        expect.objectContaining({
          method: "GET",
          path: "/api/agent/applications",
          query: {
            search:
              "optional case-insensitive filter matching title, company, status, status label, URL, and applied date",
          },
          response: {
            applications: body.applicationSummaryFields,
          },
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/agent/applications",
          response: body.applicationSummaryFields,
        }),
      ]),
    );
    expect(typeof body.errors.codes["400"]).toBe("string");
    expect(typeof body.errors.codes["401"]).toBe("string");
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
    await Promise.resolve(repository!.create("DB Only"));

    const response = await getAgentInfo();
    const body = (await response.json()) as { authentication: { tokenSource: string } };
    expect(body.authentication.tokenSource).toBe("database");
  });

  test("GET /api/agent reports both tokenSource when env and DB tokens are configured", async () => {
    const repository = getAgentApiTokenRepository();
    expect(repository).not.toBeNull();
    await Promise.resolve(repository!.create("DB Token"));

    const response = await getAgentInfo();
    const body = (await response.json()) as { authentication: { tokenSource: string } };
    expect(body.authentication.tokenSource).toBe("both");
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

  test("GET /api/agent/applications returns application URLs and statuses only after auth", async () => {
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
    expect(typeof body.applications[0]?.id).toBe("string");
    expect(typeof body.applications[0]?.updatedAt).toBe("string");
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

  test("GET /api/agent/applications rejects invalid search query", async () => {
    const response = await agentApplicationsRoute.GET(
      authorizedRequest(`/api/agent/applications?search=${"x".repeat(201)}`),
    );

    expect(response.status).toBe(400);
  });

  test("POST /api/agent/applications rejects missing and invalid bearer tokens", async () => {
    const body = JSON.stringify({ url: "https://jobs.example.com/role" });

    const missingResponse = await agentApplicationsRoute.POST(
      new Request("http://localhost/api/agent/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );
    expect(missingResponse.status).toBe(401);

    const invalidResponse = await agentApplicationsRoute.POST(
      new Request("http://localhost/api/agent/applications", {
        method: "POST",
        headers: {
          Authorization: "Bearer wrong-token",
          "Content-Type": "application/json",
        },
        body,
      }),
    );
    expect(invalidResponse.status).toBe(401);
  });

  test("POST /api/agent/applications ignores submitted status and stores to_apply", async () => {
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
        body: JSON.stringify({
          url: "https://jobs.example.com/parsed",
          status: "applied",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { status: string; url: string };
    expect(body.status).toBe("to_apply");
    expect(body.url).toBe("https://jobs.example.com/parsed");

    const [stored] = await getRepository().list();
    expect(stored?.status).toBe("to_apply");
  });

  test("agent applications route does not export forbidden mutations", () => {
    expect("PATCH" in agentApplicationsRoute).toBe(false);
    expect("DELETE" in agentApplicationsRoute).toBe(false);
  });
});

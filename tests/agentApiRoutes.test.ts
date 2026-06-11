import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { getRepository, useTestDatabase } from "@/lib/server/db";
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
    const response = getAgentInfo();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      capabilities: { method: string; path: string }[];
      limitations: string[];
    };
    expect(body.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/agent/applications" }),
        expect.objectContaining({ method: "POST", path: "/api/agent/applications" }),
      ]),
    );
    expect(body.limitations).toContain("No delete endpoint");
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
    });
    expect(body.applications[0]).not.toHaveProperty("contactEmail");
    expect(body.applications[0]).not.toHaveProperty("fullJd");
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

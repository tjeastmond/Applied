import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { openDatabase } from "@/lib/server/db/migrate";
import { getAgentApiTokenRepository, resetDatabaseBackend, useTestDatabase } from "@/lib/server/db";
import { GET as listAgentTokensRoute, POST as createAgentTokenRoute } from "@/app/api/admin/agent-tokens/route";
import { DELETE as revokeAgentTokenRoute } from "@/app/api/admin/agent-tokens/[id]/route";
import { authorizedAppRequest, restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

const originalAgentApiToken = process.env.AGENT_API_TOKEN;
const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("admin agent token routes", () => {
  beforeEach(() => {
    withTestAppAccessToken();
    delete process.env.AGENT_API_TOKEN;
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    if (originalAgentApiToken === undefined) {
      delete process.env.AGENT_API_TOKEN;
    } else {
      process.env.AGENT_API_TOKEN = originalAgentApiToken;
    }
    restoreAppAccessToken(originalAppAccessToken);
    resetDatabaseBackend();
  });

  test("GET /api/admin/agent-tokens requires app access", async () => {
    const response = await listAgentTokensRoute(new Request("http://localhost/api/admin/agent-tokens"));
    expect(response.status).toBe(401);
  });

  test("POST creates a token and GET lists it without the secret", async () => {
    const createResponse = await createAgentTokenRoute(
      authorizedAppRequest("/api/admin/agent-tokens", {
        method: "POST",
        body: JSON.stringify({ name: "CI Agent" }),
      }),
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      token: string;
      record: { id: string; name: string; tokenPrefix: string; createdAt: string };
    };
    expect(created.token.length).toBeGreaterThan(20);
    expect(created.record.name).toBe("CI Agent");

    const listResponse = await listAgentTokensRoute(authorizedAppRequest("/api/admin/agent-tokens"));
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as {
      tokens: { id: string; name: string; tokenPrefix: string }[];
      envTokenConfigured: boolean;
    };
    expect(listed.envTokenConfigured).toBe(false);
    expect(listed.tokens).toEqual([
      {
        id: created.record.id,
        name: "CI Agent",
        tokenPrefix: created.record.tokenPrefix,
        createdAt: created.record.createdAt,
      },
    ]);
  });

  test("GET reports envTokenConfigured when AGENT_API_TOKEN is set", async () => {
    process.env.AGENT_API_TOKEN = "env-bootstrap-token";

    const response = await listAgentTokensRoute(authorizedAppRequest("/api/admin/agent-tokens"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { envTokenConfigured: boolean };
    expect(body.envTokenConfigured).toBe(true);
  });

  test("DELETE revokes an existing token", async () => {
    const repository = getAgentApiTokenRepository();
    expect(repository).not.toBeNull();

    const created = await Promise.resolve(repository!.create("Temporary"));
    const response = await revokeAgentTokenRoute(
      authorizedAppRequest(`/api/admin/agent-tokens/${created.record.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: created.record.id }) },
    );

    expect(response.status).toBe(204);
    expect(repository!.listActive()).toEqual([]);
  });
});

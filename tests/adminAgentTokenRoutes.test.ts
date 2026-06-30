import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { openDatabase } from "@/lib/server/db/migrate";
import { getAgentApiTokenRepository, resetDatabaseBackend, useTestDatabase } from "@/lib/server/db";
import { GET as listAgentTokensRoute, POST as createAgentTokenRoute } from "@/app/api/admin/agent-tokens/route";
import { POST as importAgentTokenFromEnvRoute } from "@/app/api/admin/agent-tokens/from-env/route";
import {
  DELETE as revokeAgentTokenRoute,
  PATCH as renameAgentTokenRoute,
} from "@/app/api/admin/agent-tokens/[id]/route";
import { authorizedAppRequest, emptyRouteContext, restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

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
    const response = await listAgentTokensRoute(
      new Request("http://localhost/api/admin/agent-tokens"),
      emptyRouteContext,
    );
    expect(response.status).toBe(401);
  });

  test("POST creates a token and GET lists it without the secret", async () => {
    const createResponse = await createAgentTokenRoute(
      authorizedAppRequest("/api/admin/agent-tokens", {
        method: "POST",
        body: JSON.stringify({ name: "CI Agent" }),
      }),
      emptyRouteContext,
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      token: string;
      record: { id: string; name: string; tokenPrefix: string; createdAt: string; lastUsedAt: string | null };
    };
    expect(created.token.length).toBeGreaterThan(20);
    expect(created.record.name).toBe("CI Agent");

    const listResponse = await listAgentTokensRoute(authorizedAppRequest("/api/admin/agent-tokens"), emptyRouteContext);
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as {
      tokens: { id: string; name: string; tokenPrefix: string; createdAt: string; lastUsedAt: string | null }[];
      envTokenConfigured: boolean;
      envTokenRegistered: boolean;
    };
    expect(listed.envTokenConfigured).toBe(false);
    expect(listed.envTokenRegistered).toBe(false);
    expect(listed.tokens).toEqual([
      {
        id: created.record.id,
        name: "CI Agent",
        tokenPrefix: created.record.tokenPrefix,
        createdAt: created.record.createdAt,
        lastUsedAt: null,
      },
    ]);
  });

  test("GET reports env token status when AGENT_API_TOKEN is set", async () => {
    process.env.AGENT_API_TOKEN = "env-bootstrap-token";

    const response = await listAgentTokensRoute(authorizedAppRequest("/api/admin/agent-tokens"), emptyRouteContext);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { envTokenConfigured: boolean; envTokenRegistered: boolean };
    expect(body.envTokenConfigured).toBe(true);
    expect(body.envTokenRegistered).toBe(false);
  });

  test("POST /from-env registers the environment token", async () => {
    process.env.AGENT_API_TOKEN = "env-bootstrap-token";

    const response = await importAgentTokenFromEnvRoute(
      authorizedAppRequest("/api/admin/agent-tokens/from-env", {
        method: "POST",
        body: JSON.stringify({ name: "Environment" }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { record: { name: string; lastUsedAt: string | null } };
    expect(body.record.name).toBe("Environment");
    expect(body.record.lastUsedAt).toBeNull();

    const listResponse = await listAgentTokensRoute(authorizedAppRequest("/api/admin/agent-tokens"), emptyRouteContext);
    const listed = (await listResponse.json()) as { envTokenRegistered: boolean; tokens: { name: string }[] };
    expect(listed.envTokenRegistered).toBe(true);
    expect(listed.tokens).toHaveLength(1);
  });

  test("POST /from-env returns 400 when env token is unset", async () => {
    const response = await importAgentTokenFromEnvRoute(
      authorizedAppRequest("/api/admin/agent-tokens/from-env", {
        method: "POST",
        body: JSON.stringify({ name: "Environment" }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(400);
  });

  test("POST /from-env returns 409 when env token is already registered", async () => {
    process.env.AGENT_API_TOKEN = "env-bootstrap-token";

    const first = await importAgentTokenFromEnvRoute(
      authorizedAppRequest("/api/admin/agent-tokens/from-env", {
        method: "POST",
        body: JSON.stringify({ name: "Environment" }),
      }),
      emptyRouteContext,
    );
    expect(first.status).toBe(201);

    const second = await importAgentTokenFromEnvRoute(
      authorizedAppRequest("/api/admin/agent-tokens/from-env", {
        method: "POST",
        body: JSON.stringify({ name: "Environment Again" }),
      }),
      emptyRouteContext,
    );
    expect(second.status).toBe(409);
  });

  test("POST returns 409 when active token limit is reached", async () => {
    const repository = getAgentApiTokenRepository();
    expect(repository).not.toBeNull();
    await Promise.resolve(repository!.create("First"));
    await Promise.resolve(repository!.create("Second"));

    const response = await createAgentTokenRoute(
      authorizedAppRequest("/api/admin/agent-tokens", {
        method: "POST",
        body: JSON.stringify({ name: "Third" }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(409);
  });

  test("POST /from-env returns 409 when active token limit is reached", async () => {
    process.env.AGENT_API_TOKEN = "env-bootstrap-token";
    const repository = getAgentApiTokenRepository();
    expect(repository).not.toBeNull();
    await Promise.resolve(repository!.create("First"));
    await Promise.resolve(repository!.create("Second"));

    const response = await importAgentTokenFromEnvRoute(
      authorizedAppRequest("/api/admin/agent-tokens/from-env", {
        method: "POST",
        body: JSON.stringify({ name: "Environment" }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(409);
  });

  test("PATCH renames an active token", async () => {
    const repository = getAgentApiTokenRepository();
    expect(repository).not.toBeNull();

    const created = await Promise.resolve(repository!.create("Old Name"));
    const response = await renameAgentTokenRoute(
      authorizedAppRequest(`/api/admin/agent-tokens/${created.record.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      }),
      { params: Promise.resolve({ id: created.record.id }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string };
    expect(body.name).toBe("New Name");
  });

  test("PATCH returns 404 for missing token", async () => {
    const response = await renameAgentTokenRoute(
      authorizedAppRequest("/api/admin/agent-tokens/00000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ name: "Missing" }),
      }),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) },
    );

    expect(response.status).toBe(404);
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

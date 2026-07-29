import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { listApplications } from "@/lib/agentCli/client";
import { AgentCliConfigError, normalizeAgentStatus, resolveAgentCliConfig } from "@/lib/agentCli/config";

vi.mock("@/lib/server/loadEnvFile", () => ({
  loadProjectEnvFiles: vi.fn(),
}));

const originalEnv = { ...process.env };

describe("agent CLI config", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AGENT_API_TOKEN;
    delete process.env.APPLIED_DEV_URL;
    delete process.env.PORT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("resolveAgentCliConfig rejects missing token", () => {
    expect(() => resolveAgentCliConfig()).toThrow(AgentCliConfigError);
    try {
      resolveAgentCliConfig();
    } catch (error) {
      expect(error).toBeInstanceOf(AgentCliConfigError);
      expect((error as AgentCliConfigError).exitCode).toBe(2);
    }
  });

  test("resolveAgentCliConfig uses env token and default base URL", () => {
    process.env.AGENT_API_TOKEN = "cli-token";
    process.env.PORT = "4040";

    expect(resolveAgentCliConfig()).toEqual({
      baseUrl: "http://localhost:4040",
      token: "cli-token",
    });
  });

  test("resolveAgentCliConfig honors overrides", () => {
    process.env.AGENT_API_TOKEN = "ignored";

    expect(
      resolveAgentCliConfig({
        tokenOverride: "override-token",
        baseUrlOverride: "https://applied.example/",
      }),
    ).toEqual({
      baseUrl: "https://applied.example",
      token: "override-token",
    });
  });

  test("normalizeAgentStatus maps apply aliases to to_apply", () => {
    expect(normalizeAgentStatus("apply")).toBe("to_apply");
    expect(normalizeAgentStatus("to-apply")).toBe("to_apply");
    expect(normalizeAgentStatus("to_apply")).toBe("to_apply");
    expect(normalizeAgentStatus("applied")).toBe("applied");
  });
});

describe("agent CLI client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("listApplications always sends Authorization header", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ applications: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await listApplications({ baseUrl: "http://localhost:3030", token: "cli-token" }, "engineer");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3030/api/agent/applications?search=engineer");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer cli-token",
    });
  });
});

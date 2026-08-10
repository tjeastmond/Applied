import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET as getAgentOpenApi } from "@/app/api/agent/openapi/route";
import { buildAgentOpenApiDocument } from "@/lib/openapi/generateDocument";

const AGENT_ROUTE_FILES = [
  "src/app/api/agent/route.ts",
  "src/app/api/agent/docs/route.ts",
  "src/app/api/agent/applications/route.ts",
  "src/app/api/agent/applications/[id]/route.ts",
  "src/app/api/agent/applications/[id]/notes/route.ts",
  "src/app/api/agent/companies/route.ts",
] as const;

function exportedMethods(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  return (["GET", "POST", "PATCH", "DELETE"] as const).filter((method) =>
    new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`).test(source),
  );
}

function routePathFromFile(filePath: string): string {
  return filePath
    .replace("src/app/api", "/api")
    .replace("/route.ts", "")
    .replace(/\[(\w+)\]/g, "{$1}");
}

describe("agent OpenAPI spec", () => {
  it("GET /api/agent/openapi returns OpenAPI 3.1 JSON without auth", async () => {
    const response = getAgentOpenApi();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, Record<string, unknown>>;
      components: { securitySchemes: Record<string, unknown> };
    };

    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("Applied.dev Agent API");
    expect(body.components.securitySchemes.AgentBearer).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(body.paths["/api/agent/applications"]?.get).toBeDefined();
    expect(body.paths["/api/agent/applications"]?.post).toBeDefined();
  });

  it("documents every exported agent route method", () => {
    const doc = buildAgentOpenApiDocument();
    const documented = new Set(
      Object.entries(doc.paths ?? {}).flatMap(([path, operations]) =>
        Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`),
      ),
    );

    for (const file of AGENT_ROUTE_FILES) {
      const routePath = routePathFromFile(file);
      for (const method of exportedMethods(file)) {
        expect(documented.has(`${method} ${routePath}`)).toBe(true);
      }
    }
  });

  it("requires AgentBearer security on mutating application routes", () => {
    const doc = buildAgentOpenApiDocument();
    const postApplications = doc.paths?.["/api/agent/applications"]?.post as
      | { security?: Record<string, unknown>[] }
      | undefined;

    expect(postApplications?.security).toEqual([{ AgentBearer: [] }]);
  });
});

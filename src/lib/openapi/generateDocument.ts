import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registerAgentPaths } from "@/lib/openapi/agentPaths";
import { registerSharedComponents } from "@/lib/openapi/components";
import { registry } from "@/lib/openapi/registry";
import { AGENT_API_VERSION } from "@/lib/server/agentDiscovery";

let initialized = false;

function ensureAgentOpenApiRegistered() {
  if (initialized) {
    return;
  }

  registerSharedComponents(registry);
  registerAgentPaths(registry);
  initialized = true;
}

export function buildAgentOpenApiDocument() {
  ensureAgentOpenApiRegistered();

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Applied.dev Agent API",
      version: String(AGENT_API_VERSION),
      description:
        "HTTP API for agents and the applied-agent CLI. Mutating routes require a bearer token. The OpenAPI document itself is public.",
    },
    servers: [{ url: "/", description: "Current host" }],
  });
}

/** Test-only reset so Vitest can rebuild the registry between cases if needed. */
export function resetAgentOpenApiRegistrationForTests() {
  initialized = false;
}

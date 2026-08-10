import "@/lib/openapi/zodOpenApi";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { agentCreateApplicationSchema, agentPatchApplicationSchema } from "@/lib/schemas/agent";
import { applicationStatusSchema } from "@/lib/schemas/common";

export const apiErrorSchema = z
  .object({
    error: z.string(),
  })
  .meta({ id: "ApiError", description: "Standard error response" });

export const agentApplicationSummarySchema = z
  .object({
    id: z.uuid(),
    url: z.url(),
    status: applicationStatusSchema,
    title: z.string().nullable(),
    company: z.string().nullable(),
    appliedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "AgentApplicationSummary" });

export const agentNoteSummarySchema = z
  .object({
    id: z.uuid(),
    content: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "AgentNoteSummary" });

/** Wire-format body for note create (runtime route uses sanitized `createApplicationNoteSchema`). */
export const agentCreateNoteBodySchema = z
  .object({
    content: z.string().min(1).max(10_000),
  })
  .meta({ id: "AgentCreateNote" });

export const agentApplicationsListResponseSchema = z
  .object({
    applications: z.array(agentApplicationSummarySchema),
  })
  .meta({ id: "AgentApplicationsListResponse" });

export const agentNotesListResponseSchema = z
  .object({
    notes: z.array(agentNoteSummarySchema),
  })
  .meta({ id: "AgentNotesListResponse" });

export const agentCompaniesListResponseSchema = z
  .object({
    companies: z.array(z.string()),
  })
  .meta({ id: "AgentCompaniesListResponse" });

export function registerSharedComponents(registry: OpenAPIRegistry) {
  registry.register("ApiError", apiErrorSchema);
  registry.register("AgentApplicationSummary", agentApplicationSummarySchema);
  registry.register("AgentNoteSummary", agentNoteSummarySchema);
  registry.register(
    "AgentCreateApplication",
    agentCreateApplicationSchema.meta({
      id: "AgentCreateApplication",
      description: "Default status is to_apply when omitted.",
    }),
  );
  registry.register("AgentPatchApplication", agentPatchApplicationSchema.meta({ id: "AgentPatchApplication" }));
  registry.register("AgentCreateNote", agentCreateNoteBodySchema);

  registry.registerComponent("securitySchemes", "AgentBearer", {
    type: "http",
    scheme: "bearer",
    description: "AGENT_API_TOKEN or a named token from Admin → Agent API Tokens. Do not use APP_ACCESS_TOKEN.",
  });
}

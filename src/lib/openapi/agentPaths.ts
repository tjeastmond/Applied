import "@/lib/openapi/zodOpenApi";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  agentApplicationSummarySchema,
  agentApplicationsListResponseSchema,
  agentArchiveStaleResponseSchema,
  agentCompaniesListResponseSchema,
  agentCompanySummarySchema,
  agentCreateNoteBodySchema,
  agentNoteSummarySchema,
  agentNotesListResponseSchema,
} from "@/lib/openapi/components";
import { agentErrorResponses } from "@/lib/openapi/responses";
import {
  agentCreateApplicationSchema,
  agentCreateCompanySchema,
  agentListApplicationsQuerySchema,
  agentListCompaniesQuerySchema,
  agentPatchApplicationSchema,
  agentPatchCompanySchema,
  agentSetCompanyIgnoredSchema,
} from "@/lib/schemas/agent";

const jsonBody = (schema: ZodType) => ({ content: { "application/json": { schema } } });
const ok = (description: string, schema: ZodType) => ({ description, ...jsonBody(schema) });

const agentSecurity = [{ AgentBearer: [] }];

const applicationIdParamsSchema = z.object({
  id: z.uuid().meta({ description: "Application id" }),
});

export function registerAgentPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/api/agent/applications",
    tags: ["Applications"],
    summary: "List application summaries",
    description: "Returns non-archived applications, newest updated first.",
    security: agentSecurity,
    request: {
      query: agentListApplicationsQuerySchema,
    },
    responses: {
      200: ok("Application summaries", agentApplicationsListResponseSchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/agent/applications",
    tags: ["Applications"],
    summary: "Create application from job URL",
    description:
      'Parses title, company, salaryRange, and fullJd from the URL when available. Adds audit note "Saved by {token name}: API|CLI".',
    security: agentSecurity,
    request: {
      body: jsonBody(agentCreateApplicationSchema),
    },
    responses: {
      201: ok("Created application summary", agentApplicationSummarySchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/agent/applications/archive-stale",
    tags: ["Applications"],
    summary: "Archive stale applications as no_response",
    description:
      'Marks non-archived applied, waiting, interviewing, and no_response applications with no update in the last 2 months as no_response and archives them. Records status history, status-update note, and audit note "Updated by {token name}, via api|cli". Pass dryRun=1 to preview.',
    security: agentSecurity,
    request: {
      query: z.object({
        dryRun: z.enum(["0", "1"]).optional().meta({ description: "1 to list affected applications without changes" }),
      }),
    },
    responses: {
      200: ok("Affected applications", agentArchiveStaleResponseSchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/agent/applications/{id}",
    tags: ["Applications"],
    summary: "Get one application",
    security: agentSecurity,
    request: {
      params: applicationIdParamsSchema,
    },
    responses: {
      200: ok("Application summary", agentApplicationSummarySchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/agent/applications/{id}",
    tags: ["Applications"],
    summary: "Update status only",
    description:
      'Creates a status-update note, status history entry, and audit note "Updated by {token name}, via api|cli".',
    security: agentSecurity,
    request: {
      params: applicationIdParamsSchema,
      body: jsonBody(agentPatchApplicationSchema),
    },
    responses: {
      200: ok("Updated application summary", agentApplicationSummarySchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/agent/applications/{id}/notes",
    tags: ["Notes"],
    summary: "List notes for an application",
    security: agentSecurity,
    request: {
      params: applicationIdParamsSchema,
    },
    responses: {
      200: ok("Notes for the application", agentNotesListResponseSchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/agent/applications/{id}/notes",
    tags: ["Notes"],
    summary: "Add a note to an application",
    security: agentSecurity,
    request: {
      params: applicationIdParamsSchema,
      body: jsonBody(agentCreateNoteBodySchema),
    },
    responses: {
      201: ok("Created note", agentNoteSummarySchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/agent/companies",
    tags: ["Companies"],
    summary: "List companies",
    description: "Returns company records sorted alphabetically.",
    security: agentSecurity,
    request: {
      query: agentListCompaniesQuerySchema,
    },
    responses: {
      200: ok("Companies", agentCompaniesListResponseSchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/agent/companies",
    tags: ["Companies"],
    summary: "Create company",
    security: agentSecurity,
    request: {
      body: jsonBody(agentCreateCompanySchema),
    },
    responses: {
      201: ok("Created company", agentCompanySummarySchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/agent/companies/{id}",
    tags: ["Companies"],
    summary: "Update company name",
    security: agentSecurity,
    request: {
      params: z.object({ id: z.uuid() }),
      body: jsonBody(agentPatchCompanySchema),
    },
    responses: {
      200: ok("Updated company", agentCompanySummarySchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/agent/companies/{id}/ignore",
    tags: ["Companies"],
    summary: "Set company ignored flag",
    security: agentSecurity,
    request: {
      params: z.object({ id: z.uuid() }),
      body: jsonBody(agentSetCompanyIgnoredSchema),
    },
    responses: {
      200: ok("Updated company", agentCompanySummarySchema),
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/agent",
    tags: ["Meta"],
    summary: "JSON discovery document",
    description: "CLI-oriented discovery payload with capabilities, limitations, and CLI examples.",
    security: agentSecurity,
    responses: {
      200: {
        description: "Discovery JSON",
      },
      401: agentErrorResponses[401],
      503: agentErrorResponses[503],
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/agent/docs",
    tags: ["Meta"],
    summary: "Markdown reference",
    security: agentSecurity,
    responses: {
      200: {
        description: "Markdown documentation",
        content: {
          "text/markdown": {
            schema: z.string(),
          },
        },
      },
      401: agentErrorResponses[401],
      503: agentErrorResponses[503],
    },
  });
}

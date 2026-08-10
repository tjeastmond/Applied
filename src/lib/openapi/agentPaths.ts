import "@/lib/openapi/zodOpenApi";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  agentApplicationSummarySchema,
  agentApplicationsListResponseSchema,
  agentCompaniesListResponseSchema,
  agentCreateNoteBodySchema,
  agentNoteSummarySchema,
  agentNotesListResponseSchema,
} from "@/lib/openapi/components";
import { agentErrorResponses } from "@/lib/openapi/responses";
import {
  agentCreateApplicationSchema,
  agentListApplicationsQuerySchema,
  agentListCompaniesQuerySchema,
  agentPatchApplicationSchema,
} from "@/lib/schemas/agent";

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
      200: {
        description: "Application summaries",
        content: {
          "application/json": {
            schema: agentApplicationsListResponseSchema,
          },
        },
      },
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/agent/applications",
    tags: ["Applications"],
    summary: "Create application from job URL",
    description:
      'Parses title, company, salaryRange, and fullJd from the URL when available. Adds audit note "Created by the CLI".',
    security: agentSecurity,
    request: {
      body: {
        content: {
          "application/json": {
            schema: agentCreateApplicationSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created application summary",
        content: {
          "application/json": {
            schema: agentApplicationSummarySchema,
          },
        },
      },
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
      200: {
        description: "Application summary",
        content: {
          "application/json": {
            schema: agentApplicationSummarySchema,
          },
        },
      },
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/agent/applications/{id}",
    tags: ["Applications"],
    summary: "Update status only",
    description: 'Creates a status-update note, status history entry, and audit note "Updated by the CLI".',
    security: agentSecurity,
    request: {
      params: applicationIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: agentPatchApplicationSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated application summary",
        content: {
          "application/json": {
            schema: agentApplicationSummarySchema,
          },
        },
      },
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
      200: {
        description: "Notes for the application",
        content: {
          "application/json": {
            schema: agentNotesListResponseSchema,
          },
        },
      },
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
      body: {
        content: {
          "application/json": {
            schema: agentCreateNoteBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created note",
        content: {
          "application/json": {
            schema: agentNoteSummarySchema,
          },
        },
      },
      ...agentErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/agent/companies",
    tags: ["Companies"],
    summary: "List distinct company names",
    description: "Returns sorted company names from non-archived applications.",
    security: agentSecurity,
    request: {
      query: agentListCompaniesQuerySchema,
    },
    responses: {
      200: {
        description: "Company names",
        content: {
          "application/json": {
            schema: agentCompaniesListResponseSchema,
          },
        },
      },
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

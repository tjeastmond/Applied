import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import { apiErrorSchema } from "@/lib/openapi/components";

export const agentErrorResponses = {
  400: {
    description: "Invalid request body, query, or unparsable job URL",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
  401: {
    description: "Missing or invalid bearer token",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
  404: {
    description: "Application not found (or archived)",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
  503: {
    description: "No agent API token is configured",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
} satisfies Record<string, ResponseConfig>;

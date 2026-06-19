import { resolveAgentTokenSource } from "@/lib/agentTokenLimits";
import { APPLICATION_STATUSES } from "@/lib/applicationStatus";
import { isAgentEnvTokenConfigured } from "@/lib/server/agentEnvToken";
import { getAgentApiTokenRepository } from "@/lib/server/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const APPLICATION_SUMMARY_FIELDS = ["id", "url", "status", "title", "company", "appliedAt", "updatedAt"] as const;

export async function GET() {
  const repository = getAgentApiTokenRepository();
  const envConfigured = isAgentEnvTokenConfigured();
  const dbHasActiveTokens = repository ? await Promise.resolve(repository.hasActiveTokens()) : false;
  const tokenSource = resolveAgentTokenSource(envConfigured, dbHasActiveTokens);

  return NextResponse.json({
    service: "applied.dev agent API",
    version: 1,
    authentication: {
      type: "bearer",
      header: "Authorization: Bearer <token>",
      tokenEnvVar: "AGENT_API_TOKEN",
      tokenManagement: "Create named tokens in the Admin panel or set AGENT_API_TOKEN for a bootstrap token.",
      tokenSource,
      discoveryIsPublic: true,
      requiredFor: ["/api/agent/applications"],
    },
    applicationSummaryFields: APPLICATION_SUMMARY_FIELDS,
    statuses: APPLICATION_STATUSES,
    capabilities: [
      {
        name: "list_applications",
        method: "GET",
        path: "/api/agent/applications",
        description: "List agent-safe application summaries.",
        query: {
          search:
            "optional case-insensitive filter matching title, company, status, status label, URL, and applied date",
        },
        response: {
          applications: APPLICATION_SUMMARY_FIELDS,
        },
      },
      {
        name: "create_application_from_url",
        method: "POST",
        path: "/api/agent/applications",
        description: "Create a new application from a job URL using the existing parser.",
        requestBody: {
          url: "http(s) job posting URL (required; extra fields are ignored)",
        },
        response: APPLICATION_SUMMARY_FIELDS,
        behavior: [
          "Status is always set to to_apply",
          "Title, company, salaryRange, and fullJd are parsed from the URL when available",
          "Parsed salaryRange and fullJd are stored but not returned in the agent response",
        ],
      },
    ],
    errors: {
      format: { error: "string" },
      codes: {
        "400": "Invalid request body or unparsable job URL",
        "401": "Missing or invalid bearer token",
        "503": "No agent API token is configured",
      },
    },
    limitations: [
      "No edit endpoint",
      "No status update endpoint",
      "No delete endpoint",
      "No notes endpoint",
      "No backup/import endpoint",
      "Archived applications are excluded from list responses",
      "No archive or unarchive endpoint",
      "No access to recruiter, contact, salary, or job-description fields in responses",
    ],
  });
}

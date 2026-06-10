import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    service: "applied.dev agent API",
    version: 1,
    authentication: {
      type: "bearer",
      header: "Authorization: Bearer <token>",
      tokenEnvVar: "AGENT_API_TOKEN",
    },
    capabilities: [
      {
        name: "list_applications",
        method: "GET",
        path: "/api/agent/applications",
        description: "List application summaries, including URLs and current statuses.",
      },
      {
        name: "create_application_from_url",
        method: "POST",
        path: "/api/agent/applications",
        description: "Create a new application from a job URL using the existing parser.",
        input: { url: "http(s) job posting URL" },
        status: "to_apply",
      },
    ],
    limitations: [
      "No edit endpoint",
      "No status update endpoint",
      "No delete endpoint",
      "No notes endpoint",
      "No backup/import endpoint",
    ],
  });
}

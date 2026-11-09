import { AGENT_CLI_COMMAND_SPECS } from "@/lib/agentCli/commandSpecs";
import { APPLICATION_STATUS_OPTIONS, APPLICATION_STATUSES } from "@/lib/applicationStatus";

export const AGENT_API_VERSION = 2;

export const APPLICATION_SUMMARY_FIELDS = [
  "id",
  "url",
  "status",
  "title",
  "company",
  "appliedAt",
  "updatedAt",
] as const;

export const AGENT_NOTE_FIELDS = ["id", "content", "createdAt"] as const;

export const AGENT_REQUIRED_PATHS = [
  "/api/agent",
  "/api/agent/docs",
  "/api/agent/applications",
  "/api/agent/applications/:id",
  "/api/agent/applications/archive-stale",
  "/api/agent/applications/:id/notes",
  "/api/agent/companies",
  "/api/agent/companies/:id",
  "/api/agent/companies/:id/ignore",
] as const;

export const AGENT_CAPABILITIES = [
  {
    name: "discovery",
    method: "GET",
    path: "/api/agent",
    description: "JSON discovery document for the agent API and CLI.",
  },
  {
    name: "docs",
    method: "GET",
    path: "/api/agent/docs",
    description: "Markdown reference for agents and CLI usage.",
  },
  {
    name: "list_applications",
    method: "GET",
    path: "/api/agent/applications",
    description: "List agent-safe application summaries.",
    query: {
      search: "optional case-insensitive filter matching title, company, status, status label, URL, and applied date",
    },
    response: {
      applications: APPLICATION_SUMMARY_FIELDS,
    },
  },
  {
    name: "get_application",
    method: "GET",
    path: "/api/agent/applications/:id",
    description: "Get a single non-archived application summary.",
    response: APPLICATION_SUMMARY_FIELDS,
  },
  {
    name: "create_application_from_url",
    method: "POST",
    path: "/api/agent/applications",
    description: "Create a new application from a job URL using the existing parser.",
    requestBody: {
      url: "http(s) job posting URL (required)",
      status: "optional application status (defaults to to_apply)",
    },
    response: APPLICATION_SUMMARY_FIELDS,
    behavior: [
      "Default status is to_apply when status is omitted",
      "Title, company, salaryRange, and fullJd are parsed from the URL when available",
      "Parsed salaryRange and fullJd are stored but not returned in the agent response",
      'Adds audit note "Saved by {token name}: API|CLI" (CLI sends x-applied-dev-client: cli)',
    ],
  },
  {
    name: "update_application_status",
    method: "PATCH",
    path: "/api/agent/applications/:id",
    description: "Update application status only.",
    requestBody: {
      status: "application status (required)",
    },
    response: APPLICATION_SUMMARY_FIELDS,
    behavior: [
      "Creates a status-update note and status history entry",
      'Adds audit note "Updated by {token name}, via api|cli"',
    ],
  },
  {
    name: "archive_stale_applications",
    method: "POST",
    path: "/api/agent/applications/archive-stale",
    description:
      "Mark non-archived applied, waiting, interviewing, and no_response applications with no update in the last 2 months as no_response and archive them.",
    query: {
      dryRun: "optional; 1 lists affected applications without changing anything",
    },
    response: {
      dryRun: "boolean",
      archivedCount: "number archived (0 on dry run)",
      applications: APPLICATION_SUMMARY_FIELDS,
    },
    behavior: [
      "Creates a status-update note and status history entry for each status change",
      'Adds audit note "Updated by {token name}, via api|cli"',
      "Offers, passed, rejected, and to_apply applications are never touched",
    ],
  },
  {
    name: "list_notes",
    method: "GET",
    path: "/api/agent/applications/:id/notes",
    description: "List notes for an application.",
    response: {
      notes: AGENT_NOTE_FIELDS,
    },
  },
  {
    name: "create_note",
    method: "POST",
    path: "/api/agent/applications/:id/notes",
    description: "Add a note to an application.",
    requestBody: {
      content: "note body (required)",
    },
    response: AGENT_NOTE_FIELDS,
  },
  {
    name: "list_companies",
    method: "GET",
    path: "/api/agent/companies",
    description: "List company records.",
    query: {
      search: "optional case-insensitive substring filter on company name",
      ignored: "optional 0|1 filter for ignored companies",
    },
    response: {
      companies: ["id", "name", "url", "linkedinUrl", "email", "ignored", "createdAt", "updatedAt"],
    },
  },
  {
    name: "create_company",
    method: "POST",
    path: "/api/agent/companies",
    description: "Create a company record.",
    requestBody: {
      name: "company name (required)",
      url: "optional company website URL",
      linkedinUrl: "optional LinkedIn URL",
      email: "optional contact email",
    },
    response: ["id", "name", "url", "linkedinUrl", "email", "ignored", "createdAt", "updatedAt"],
  },
  {
    name: "update_company",
    method: "PATCH",
    path: "/api/agent/companies/:id",
    description: "Update a company record.",
    requestBody: {
      name: "optional company name",
      url: "optional company website URL",
      linkedinUrl: "optional LinkedIn URL",
      email: "optional contact email",
    },
    response: ["id", "name", "url", "linkedinUrl", "email", "ignored", "createdAt", "updatedAt"],
  },
  {
    name: "set_company_ignored",
    method: "PATCH",
    path: "/api/agent/companies/:id/ignore",
    description: "Toggle a company ignored flag.",
    requestBody: {
      ignored: "boolean (required)",
    },
    response: ["id", "name", "ignored", "createdAt", "updatedAt"],
  },
] as const;

export const AGENT_LIMITATIONS = [
  "No delete endpoint",
  "No archive or unarchive endpoint",
  "No backup/import endpoint",
  "No user management endpoint",
  "No full application PATCH (recruiter, contact, salary, etc.)",
  "No note edit or delete endpoint",
  "Archived applications are excluded from list and company responses",
  "No access to recruiter, contact, salary, or job-description fields in responses",
] as const;

export const AGENT_CLI_COMMANDS = AGENT_CLI_COMMAND_SPECS.map((spec) => `pnpm applied:agent ${spec.usage}`);

export function buildAgentDiscoveryPayload(tokenSource: string) {
  return {
    service: "applied.dev agent API",
    version: AGENT_API_VERSION,
    authentication: {
      type: "bearer",
      header: "Authorization: Bearer <token>",
      tokenEnvVar: "AGENT_API_TOKEN",
      tokenManagement: "Create named tokens in the Admin panel or set AGENT_API_TOKEN for a bootstrap token.",
      tokenSource,
      discoveryIsPublic: false,
      requiredFor: [...AGENT_REQUIRED_PATHS],
    },
    applicationSummaryFields: APPLICATION_SUMMARY_FIELDS,
    noteFields: AGENT_NOTE_FIELDS,
    statuses: APPLICATION_STATUSES,
    capabilities: AGENT_CAPABILITIES,
    cli: {
      command: "pnpm applied:agent",
      env: {
        APPLIED_DEV_URL: "Base URL (default http://localhost:3030)",
        AGENT_API_TOKEN: "Required bearer token for every request",
      },
      examples: AGENT_CLI_COMMANDS,
    },
    documentationUrl: "/api/agent/docs",
    openapiUrl: "/api/agent/openapi",
    interactiveDocumentationUrl: "/agent/docs",
    errors: {
      format: { error: "string" },
      codes: {
        "400": "Invalid request body or unparsable job URL",
        "401": "Missing or invalid bearer token",
        "404": "Application or note not found",
        "503": "No agent API token is configured",
      },
    },
    limitations: AGENT_LIMITATIONS,
  };
}

export function buildAgentDocsMarkdown(): string {
  const statusLines = APPLICATION_STATUS_OPTIONS.map((option) => `- \`${option.value}\` — ${option.label}`).join("\n");
  const capabilityLines = AGENT_CAPABILITIES.map(
    (capability) => `- **${capability.method} ${capability.path}** — ${capability.description}`,
  ).join("\n");
  const cliLines = AGENT_CLI_COMMANDS.map((command) => `- \`${command}\``).join("\n");
  const limitationLines = AGENT_LIMITATIONS.map((limitation) => `- ${limitation}`).join("\n");

  return `# Applied.dev Agent API and CLI

OpenAPI spec: \`GET /api/agent/openapi\` (public). Interactive reference: \`/agent/docs\`.

All agent endpoints require bearer-token authentication except the OpenAPI document itself.

## Authentication

\`\`\`
Authorization: Bearer <AGENT_API_TOKEN>
\`\`\`

- Preferred: Admin → Agent API Tokens → create a named token
- Bootstrap: \`pnpm agent:token\` prints \`AGENT_API_TOKEN=...\` for \`.env.local\`
- Do not use \`APP_ACCESS_TOKEN\` for agent endpoints

## CLI (recommended for agents)

The CLI is an HTTP client. Run it from **any directory** against a local dev server or a deployed host (e.g. Vercel). Set \`APPLIED_DEV_URL\` for non-local targets.

\`\`\`bash
# Local (default http://localhost:3030)
applied-agent applications add --url "https://example.com/job"

# Production
APPLIED_DEV_URL=https://your-app.vercel.app AGENT_API_TOKEN=... \\
  applied-agent applications list --search engineer
\`\`\`

From the repo only: \`pnpm applied:agent …\`. Install globally: \`pnpm build:cli && pnpm setup && pnpm add -g .\`

Environment (shell exports win over .env files):
- \`APPLIED_DEV_URL\` — target host (default \`http://localhost:3030\`)
- \`APPLIED_DEV_DIR\` — optional checkout path; fills in keys not already exported
- \`AGENT_API_TOKEN\` — required on every CLI invocation

CLI commands:

${cliLines}

## HTTP endpoints

${capabilityLines}

Discovery JSON: \`GET /api/agent\`

OpenAPI: \`GET /api/agent/openapi\` · Interactive docs: \`/agent/docs\`

## Status values

${statusLines}

Default status on create: \`to_apply\` ("To Apply")

## Rules

- Add applications one at a time from job URLs
- If parsing fails because title or company is missing, report the failure — do not invent data
- Agent create adds audit note "Saved by {token name}: API|CLI"
- Agent status changes create a status-update note, history entry, and audit note "Updated by {token name}, via api|cli"
- Explicit add-note requests do not add an extra audit note
- Archived applications are hidden from list, company, and get-by-id responses

## Limitations

${limitationLines}

## Errors

Responses use \`{ "error": "message" }\` with HTTP 400, 401, 404, or 503.
`;
}

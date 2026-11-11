import { formatZodError } from "@/lib/formatZodError";
import { agentCreateApplicationSchema, agentListApplicationsQuerySchema } from "@/lib/schemas/agent";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { withAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import {
  createApplicationFromUrlForAgent,
  listApplicationsForAgent,
} from "@/lib/server/services/agentApplicationInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAgentAuth("/api/agent/applications", "GET", async (request) => {
  const { searchParams } = new URL(request.url);
  const parsedQuery = agentListApplicationsQuerySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  if (!parsedQuery.success) {
    return badRequestResponse(formatZodError(parsedQuery.error));
  }

  const applications = await listApplicationsForAgent(parsedQuery.data.search ?? "", parsedQuery.data.status);
  return NextResponse.json({ applications });
});

export const POST = withAgentAuth("/api/agent/applications", "POST", async (request, auth) => {
  const parsed = await parseRequestBody(request, agentCreateApplicationSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const result = await createApplicationFromUrlForAgent(parsed.data.url, parsed.data.status ?? "to_apply", auth);
  if (!result.ok) {
    return badRequestResponse(result.error);
  }

  log.info("agent application created", {
    route: "/api/agent/applications",
    method: "POST",
    id: result.application.id,
  });

  return NextResponse.json(result.application, { status: 201 });
});

import { formatZodError } from "@/lib/formatZodError";
import { agentCreateApplicationSchema, agentListApplicationsQuerySchema } from "@/lib/schemas/agent";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import {
  createApplicationFromUrlForAgent,
  listApplicationsForAgent,
} from "@/lib/server/services/agentApplicationInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireAgentAuth(request);
  if (authError) {
    log.warn("agent auth rejected", { route: "/api/agent/applications", method: "GET" });
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = agentListApplicationsQuerySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
  });
  if (!parsedQuery.success) {
    return badRequestResponse(formatZodError(parsedQuery.error));
  }

  const applications = await listApplicationsForAgent(parsedQuery.data.search ?? "");
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const authError = await requireAgentAuth(request);
  if (authError) {
    log.warn("agent auth rejected", { route: "/api/agent/applications", method: "POST" });
    return authError;
  }

  const parsed = await parseRequestBody(request, agentCreateApplicationSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const result = await createApplicationFromUrlForAgent(parsed.data.url);
  if (!result.ok) {
    return badRequestResponse(result.error);
  }

  log.info("agent application created", {
    route: "/api/agent/applications",
    method: "POST",
    id: result.application.id,
  });

  return NextResponse.json(result.application, { status: 201 });
}

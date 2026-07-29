import { agentPatchApplicationSchema } from "@/lib/schemas/agent";
import { requireAgentApplicationRouteContext } from "@/lib/server/agentRouteHelpers";
import { applicationNotFoundResponse, type ApplicationIdRouteContext } from "@/lib/server/applicationRouteHelpers";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { updateApplicationStatusForAgent } from "@/lib/server/services/agentApplicationInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request, context: ApplicationIdRouteContext) {
  const authError = await requireAgentAuth(request);
  if (authError) {
    log.warn("agent auth rejected", { route: "/api/agent/applications/[id]", method: "GET" });
    return authError;
  }

  const routeContext = await requireAgentApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }

  return NextResponse.json(routeContext.application);
}

export async function PATCH(request: Request, context: ApplicationIdRouteContext) {
  const authError = await requireAgentAuth(request);
  if (authError) {
    log.warn("agent auth rejected", { route: "/api/agent/applications/[id]", method: "PATCH" });
    return authError;
  }

  const routeContext = await requireAgentApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }

  const parsed = await parseRequestBody(request, agentPatchApplicationSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const updated = await updateApplicationStatusForAgent(routeContext.id, data.status);
  if (!updated) {
    return applicationNotFoundResponse();
  }

  log.info("agent application status updated", {
    route: "/api/agent/applications/[id]",
    method: "PATCH",
    id: updated.id,
    status: updated.status,
  });

  return NextResponse.json(updated);
}

import { withAgentAuth } from "@/lib/server/agentAuth";
import { conflictResponseOrThrow } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { archiveStaleApplicationsForAgent } from "@/lib/server/services/agentApplicationInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const POST = withAgentAuth("/api/agent/applications/archive-stale", "POST", async (request, auth) => {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await archiveStaleApplicationsForAgent(dryRun, auth).catch(conflictResponseOrThrow);
  if (result instanceof Response) {
    return result;
  }

  if (!dryRun && result.archivedCount > 0) {
    log.info("agent stale applications archived", {
      route: "/api/agent/applications/archive-stale",
      method: "POST",
      archivedCount: result.archivedCount,
    });
  }

  return NextResponse.json(result);
});

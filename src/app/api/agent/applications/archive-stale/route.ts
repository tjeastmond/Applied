import { requireAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { archiveStaleApplicationsForAgent } from "@/lib/server/services/agentApplicationInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAgentAuth(request);
  if (auth instanceof Response) {
    log.warn("agent auth rejected", { route: "/api/agent/applications/archive-stale", method: "POST" });
    return auth;
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await archiveStaleApplicationsForAgent(dryRun, auth);

  if (!dryRun && result.archivedCount > 0) {
    log.info("agent stale applications archived", {
      route: "/api/agent/applications/archive-stale",
      method: "POST",
      archivedCount: result.archivedCount,
    });
  }

  return NextResponse.json(result);
}

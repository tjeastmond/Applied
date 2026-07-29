import { buildAgentDocsMarkdown } from "@/lib/server/agentDiscovery";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireAgentAuth(request);
  if (authError) {
    log.warn("agent auth rejected", { route: "/api/agent/docs", method: "GET" });
    return authError;
  }

  return new NextResponse(buildAgentDocsMarkdown(), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

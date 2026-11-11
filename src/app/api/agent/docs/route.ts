import { buildAgentDocsMarkdown } from "@/lib/server/agentDiscovery";
import { withAgentAuth } from "@/lib/server/agentAuth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAgentAuth("/api/agent/docs", "GET", () => {
  return new NextResponse(buildAgentDocsMarkdown(), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
});

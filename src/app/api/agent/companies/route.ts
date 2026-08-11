import { formatZodError } from "@/lib/formatZodError";
import { agentListCompaniesQuerySchema } from "@/lib/schemas/agent";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { listCompaniesForAgent } from "@/lib/server/services/agentApplicationInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAgentAuth(request);
  if (auth instanceof Response) {
    log.warn("agent auth rejected", { route: "/api/agent/companies", method: "GET" });
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = agentListCompaniesQuerySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
  });
  if (!parsedQuery.success) {
    return badRequestResponse(formatZodError(parsedQuery.error));
  }

  const companies = await listCompaniesForAgent(parsedQuery.data.search ?? "");
  return NextResponse.json({ companies });
}

import { formatZodError } from "@/lib/formatZodError";
import { agentCreateCompanySchema, agentListCompaniesQuerySchema } from "@/lib/schemas/agent";
import { badRequestResponse, jsonError } from "@/lib/server/applicationRouteHelpers";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { createCompanyForAgent, listCompaniesForAgent } from "@/lib/server/services/agentCompanyInterface";
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
    ignored: searchParams.get("ignored") ?? undefined,
  });
  if (!parsedQuery.success) {
    return badRequestResponse(formatZodError(parsedQuery.error));
  }

  const companies = await listCompaniesForAgent(parsedQuery.data.search ?? "", parsedQuery.data.ignored);
  return NextResponse.json({ companies });
}

export async function POST(request: Request) {
  const auth = await requireAgentAuth(request);
  if (auth instanceof Response) {
    log.warn("agent auth rejected", { route: "/api/agent/companies", method: "POST" });
    return auth;
  }

  const parsed = await parseRequestBody(request, agentCreateCompanySchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  try {
    const company = await createCompanyForAgent(data);
    log.info("agent company created", {
      route: "/api/agent/companies",
      method: "POST",
      id: company.id,
      name: company.name,
    });
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Company name already exists") {
      return jsonError("Company name already exists", 409);
    }
    throw error;
  }
}

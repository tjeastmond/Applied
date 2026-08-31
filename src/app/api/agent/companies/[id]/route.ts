import { agentPatchCompanySchema } from "@/lib/schemas/agent";
import { parseUuid } from "@/lib/schemas/common";
import { jsonError } from "@/lib/server/applicationRouteHelpers";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { updateCompanyForAgent } from "@/lib/server/services/agentCompanyInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAgentAuth(request);
  if (auth instanceof Response) {
    log.warn("agent auth rejected", { route: "/api/agent/companies/[id]", method: "PATCH" });
    return auth;
  }

  const { id: rawId } = await context.params;
  const id = parseUuid(rawId);
  if (!id) {
    return jsonError("Company not found", 404);
  }

  const parsed = await parseRequestBody(request, agentPatchCompanySchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  try {
    const company = await updateCompanyForAgent(id, data);
    if (!company) {
      return jsonError("Company not found", 404);
    }

    log.info("agent company updated", {
      route: "/api/agent/companies/[id]",
      method: "PATCH",
      id: company.id,
      name: company.name,
    });
    return NextResponse.json(company);
  } catch (error) {
    if (error instanceof Error && error.message === "Company name already exists") {
      return jsonError("Company name already exists", 409);
    }
    throw error;
  }
}

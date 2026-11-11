import { agentSetCompanyIgnoredSchema } from "@/lib/schemas/agent";
import { jsonError } from "@/lib/server/applicationRouteHelpers";
import { withAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { setCompanyIgnoredForAgent } from "@/lib/server/services/agentCompanyInterface";
import { parseUuid } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = withAgentAuth(
  "/api/agent/companies/[id]/ignore",
  "PATCH",
  async (request, _auth, context: RouteContext) => {
    const { id: rawId } = await context.params;
    const id = parseUuid(rawId);
    if (!id) {
      return jsonError("Company not found", 404);
    }

    const parsed = await parseRequestBody(request, agentSetCompanyIgnoredSchema);
    const data = parsedBodyOrResponse(parsed);
    if (data instanceof Response) {
      return data;
    }

    const company = await setCompanyIgnoredForAgent(id, data.ignored);
    if (!company) {
      return jsonError("Company not found", 404);
    }

    log.info("agent company ignore status updated", {
      route: "/api/agent/companies/[id]/ignore",
      method: "PATCH",
      id: company.id,
      ignored: company.ignored,
    });
    return NextResponse.json(company);
  },
);

import { getCompanyRepository } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import {
  companyConflictResponse,
  companyNotFoundResponse,
  type CompanyIdRouteContext,
  requireCompanyRouteContext,
} from "@/lib/server/companyRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { patchCompanySchema } from "@/lib/schemas/company";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const PATCH = withAppAccess<CompanyIdRouteContext>(async (request: Request, context) => {
  const routeContext = await requireCompanyRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }
  const { id } = routeContext;

  const parsed = await parseRequestBody(request, patchCompanySchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  try {
    const updated = await getCompanyRepository().update(id, data);
    if (!updated) {
      return companyNotFoundResponse();
    }

    log.info("company updated", {
      route: "/api/companies/[id]",
      method: "PATCH",
      id: updated.id,
      name: updated.name,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Company name already exists") {
      return companyConflictResponse();
    }
    throw error;
  }
});

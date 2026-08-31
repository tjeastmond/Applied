import { getCompanyRepository } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import {
  companyNotFoundResponse,
  type CompanyIdRouteContext,
  requireCompanyRouteContext,
} from "@/lib/server/companyRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const PATCH = withAppAccess<CompanyIdRouteContext>(async (request: Request, context) => {
  const routeContext = await requireCompanyRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }
  const { id } = routeContext;

  let ignored: boolean;
  try {
    const body = (await request.json()) as { ignored?: unknown };
    if (typeof body.ignored !== "boolean") {
      return NextResponse.json({ error: "ignored must be a boolean" }, { status: 400 });
    }
    ignored = body.ignored;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updated = await getCompanyRepository().setIgnored(id, ignored);
  if (!updated) {
    return companyNotFoundResponse();
  }

  log.info("company ignore status updated", {
    route: "/api/companies/[id]/ignore",
    method: "PATCH",
    id: updated.id,
    ignored: updated.ignored,
  });
  return NextResponse.json(updated);
});

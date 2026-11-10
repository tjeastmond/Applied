import { withAppAccess } from "@/lib/server/appAuth";
import { getRepository } from "@/lib/server/db";
import { patchApplicationWithSideEffects } from "@/lib/server/services/applicationMutationService";
import {
  applicationNotFoundResponse,
  badRequestResponse,
  type ApplicationIdRouteContext,
  requireApplicationRouteContext,
} from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { ensureCompanyForApplicationName } from "@/lib/server/services/companySyncService";
import { patchJobApplicationSchema } from "@/lib/schemas/application";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const PATCH = withAppAccess<ApplicationIdRouteContext>(async (request: Request, context) => {
  const routeContext = await requireApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }
  const { id } = routeContext;

  const parsed = await parseRequestBody(request, patchJobApplicationSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const repository = getRepository();
  const existing = await repository.getById(id);
  if (!existing) {
    return applicationNotFoundResponse();
  }

  const effectiveViaRecruiter = data.viaRecruiter ?? existing.viaRecruiter;
  if (!effectiveViaRecruiter && (data.recruiterName != null || data.recruiterFirm != null)) {
    return badRequestResponse("recruiter fields require viaRecruiter: true");
  }

  const statusChanging = data.status !== undefined && data.status !== existing.status;

  const updated = await patchApplicationWithSideEffects(id, data, existing);
  if (!updated) {
    return applicationNotFoundResponse();
  }

  if (data.company !== undefined) {
    await ensureCompanyForApplicationName(updated.company);
  }

  log.info("application updated", {
    route: "/api/applications/[id]",
    method: "PATCH",
    id: updated.id,
    company: updated.company,
    status: updated.status,
    ...(statusChanging ? { statusChanged: true, previousStatus: existing.status } : { statusChanged: false }),
  });

  return NextResponse.json(updated);
});

export const DELETE = withAppAccess<ApplicationIdRouteContext>(async (_request: Request, context) => {
  const routeContext = await requireApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }
  const { id } = routeContext;

  const deleted = await getRepository().delete(id);
  if (!deleted) {
    return applicationNotFoundResponse();
  }

  log.info("application deleted", {
    route: "/api/applications/[id]",
    method: "DELETE",
    id,
  });

  return new NextResponse(null, { status: 204 });
});

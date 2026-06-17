import { statusUpdateNoteContent } from "@/lib/applicationStatus";
import { requireAppAccess } from "@/lib/server/appAuth";
import { getNoteRepository, getRepository } from "@/lib/server/db";
import {
  applicationNotFoundResponse,
  badRequestResponse,
  type ApplicationIdRouteContext,
  requireApplicationId,
} from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { sanitizeApplicationInput } from "@/lib/server/sanitizeApplicationInput";
import { patchJobApplicationSchema } from "@/lib/schemas/application";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: ApplicationIdRouteContext) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const { id: rawId } = await context.params;
  const id = await requireApplicationId(rawId);
  if (!id) {
    return applicationNotFoundResponse();
  }

  const parsed = await parseRequestBody(request, patchJobApplicationSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const repository = getRepository();
  const existing = await repository.getById(id);
  if (!existing) {
    return applicationNotFoundResponse();
  }

  const effectiveViaRecruiter = parsed.data.viaRecruiter ?? existing.viaRecruiter;
  if (!effectiveViaRecruiter && (parsed.data.recruiterName != null || parsed.data.recruiterFirm != null)) {
    return badRequestResponse("recruiter fields require viaRecruiter: true");
  }

  const sanitized = sanitizeApplicationInput(parsed.data);
  const statusChanging = sanitized.status !== undefined && sanitized.status !== existing.status;

  const updated = await repository.update(id, sanitized);
  if (!updated) {
    return applicationNotFoundResponse();
  }

  if (statusChanging && sanitized.status) {
    await getNoteRepository().create(id, statusUpdateNoteContent(sanitized.status));
  }

  log.info("application updated", {
    route: "/api/applications/[id]",
    method: "PATCH",
    id: updated.id,
    company: updated.company,
    status: updated.status,
    ...(statusChanging
      ? { statusChanged: true, previousStatus: existing.status }
      : { statusChanged: false }),
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, context: ApplicationIdRouteContext) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const { id: rawId } = await context.params;
  const id = await requireApplicationId(rawId);
  if (!id) {
    return applicationNotFoundResponse();
  }

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
}

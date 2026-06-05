import { statusUpdateNoteContent } from "@/lib/applicationStatus";
import { getNoteRepository, getRepository } from "@/lib/server/db";
import {
  applicationNotFoundResponse,
  type ApplicationIdRouteContext,
  requireApplicationId,
} from "@/lib/server/applicationRouteHelpers";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { sanitizeApplicationInput } from "@/lib/server/sanitizeApplicationInput";
import { patchJobApplicationSchema } from "@/lib/schemas/application";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: ApplicationIdRouteContext) {
  const { id: rawId } = await context.params;
  const id = await requireApplicationId(rawId);
  if (!id) {
    return applicationNotFoundResponse();
  }

  const parsed = await parseRequestBody(request, patchJobApplicationSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const repository = getRepository();
  const existing = await repository.getById(id);
  if (!existing) {
    return applicationNotFoundResponse();
  }

  const sanitized = sanitizeApplicationInput(parsed.data);
  const statusChanging =
    sanitized.status !== undefined && sanitized.status !== existing.status;

  const updated = await repository.update(id, sanitized);
  if (!updated) {
    return applicationNotFoundResponse();
  }

  if (statusChanging && sanitized.status) {
    await getNoteRepository().create(id, statusUpdateNoteContent(sanitized.status));
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: ApplicationIdRouteContext) {
  const { id: rawId } = await context.params;
  const id = await requireApplicationId(rawId);
  if (!id) {
    return applicationNotFoundResponse();
  }

  const deleted = await getRepository().delete(id);
  if (!deleted) {
    return applicationNotFoundResponse();
  }
  return new NextResponse(null, { status: 204 });
}

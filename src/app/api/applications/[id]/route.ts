import { getRepository } from "@/lib/server/db";
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

  const updated = await getRepository().update(id, sanitizeApplicationInput(parsed.data));
  if (!updated) {
    return applicationNotFoundResponse();
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

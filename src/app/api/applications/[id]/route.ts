import { getRepository } from "@/lib/server/db";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { sanitizeApplicationInput } from "@/lib/server/sanitizeApplicationInput";
import { patchJobApplicationSchema } from "@/lib/schemas/application";
import { parseUuid } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseUuid(rawId);
  if (!id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const parsed = await parseRequestBody(request, patchJobApplicationSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await getRepository().update(id, sanitizeApplicationInput(parsed.data));
  if (!updated) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseUuid(rawId);
  if (!id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const deleted = await getRepository().delete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}

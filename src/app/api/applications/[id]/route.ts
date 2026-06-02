import { getRepository } from "@/lib/server/db";
import { validatePatchInput } from "@/lib/server/validation";
import type { CreateJobApplicationInput } from "@/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await readJson<Partial<CreateJobApplicationInput>>(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validationError = validatePatchInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const updated = await getRepository().update(id, body);
  if (!updated) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await getRepository().delete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}

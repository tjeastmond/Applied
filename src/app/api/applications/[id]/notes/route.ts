import { getNoteRepository, getRepository } from "@/lib/server/db";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { parseUuid } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function requireApplicationId(rawId: string): Promise<string | null> {
  const id = parseUuid(rawId);
  if (!id) {
    return null;
  }
  const application = await getRepository().getById(id);
  return application ? id : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const notes = await getNoteRepository().listByApplicationId(applicationId);
  return NextResponse.json(notes);
}

export async function POST(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const note = await getNoteRepository().create(applicationId, parsed.data.content);
  return NextResponse.json(note, { status: 201 });
}

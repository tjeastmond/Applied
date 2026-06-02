import { getNoteRepository, getRepository } from "@/lib/server/db";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { uuidSchema } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = uuidSchema.safeParse(rawId);
  if (!idResult.success) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const application = await getRepository().getById(idResult.data);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const notes = await getNoteRepository().listByApplicationId(idResult.data);
  return NextResponse.json(notes);
}

export async function POST(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = uuidSchema.safeParse(rawId);
  if (!idResult.success) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const application = await getRepository().getById(idResult.data);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const note = await getNoteRepository().create(idResult.data, parsed.data.content);
  return NextResponse.json(note, { status: 201 });
}

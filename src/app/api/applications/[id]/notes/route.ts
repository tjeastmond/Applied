import { getNoteRepository, getRepository } from "@/lib/server/db";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { uuidSchema } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function applicationExists(id: string): Promise<boolean> {
  const application = await getRepository().getById(id);
  return application !== null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = uuidSchema.safeParse(rawId);
  if (!idResult.success || !(await applicationExists(idResult.data))) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const notes = await getNoteRepository().listByApplicationId(idResult.data);
  return NextResponse.json(notes);
}

export async function POST(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = uuidSchema.safeParse(rawId);
  if (!idResult.success || !(await applicationExists(idResult.data))) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const note = await getNoteRepository().create(idResult.data, parsed.data.content);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create note";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

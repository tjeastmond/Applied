import { getNoteRepository, getRepository } from "@/lib/server/db";
import { uuidSchema } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: rawId, noteId: rawNoteId } = await context.params;
  const idResult = uuidSchema.safeParse(rawId);
  const noteIdResult = uuidSchema.safeParse(rawNoteId);
  if (!idResult.success || !noteIdResult.success) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const application = await getRepository().getById(idResult.data);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const notes = await getNoteRepository().listByApplicationId(idResult.data);
  if (!notes.some((note) => note.id === noteIdResult.data)) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const deleted = await getNoteRepository().delete(noteIdResult.data);
  if (!deleted) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

import { getNoteRepository, getRepository } from "@/lib/server/db";
import { parseUuid } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: rawId, noteId: rawNoteId } = await context.params;
  const id = parseUuid(rawId);
  const noteId = parseUuid(rawNoteId);
  if (!id || !noteId) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const application = await getRepository().getById(id);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const notes = await getNoteRepository().listByApplicationId(id);
  if (!notes.some((note) => note.id === noteId)) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const deleted = await getNoteRepository().delete(noteId);
  if (!deleted) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

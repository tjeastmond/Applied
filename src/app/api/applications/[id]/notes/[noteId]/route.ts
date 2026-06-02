import { getNoteRepository, getRepository } from "@/lib/server/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, noteId } = await context.params;
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

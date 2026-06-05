import { getNoteRepository } from "@/lib/server/db";
import {
  applicationNotFoundResponse,
  type ApplicationNoteRouteContext,
  parseRouteUuid,
  requireApplicationId,
} from "@/lib/server/applicationRouteHelpers";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: ApplicationNoteRouteContext) {
  const { id: rawId, noteId: rawNoteId } = await context.params;
  const noteId = parseRouteUuid(rawNoteId);
  if (!noteId) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const note = await getNoteRepository().updateForApplication(applicationId, noteId, parsed.data.content);
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json(note);
}

export async function DELETE(_request: Request, context: ApplicationNoteRouteContext) {
  const { id: rawId, noteId: rawNoteId } = await context.params;
  const noteId = parseRouteUuid(rawNoteId);
  if (!noteId) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }

  const deleted = await getNoteRepository().deleteForApplication(applicationId, noteId);
  if (!deleted) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

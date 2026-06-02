import { getNoteRepository } from "@/lib/server/db";
import {
  applicationNotFoundResponse,
  type ApplicationNoteRouteContext,
  parseRouteUuid,
  requireApplicationId,
} from "@/lib/server/applicationRouteHelpers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

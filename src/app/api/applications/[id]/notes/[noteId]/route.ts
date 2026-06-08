import { parseUuid } from "@/lib/schemas/common";
import { getNoteRepository } from "@/lib/server/db";
import {
  applicationNotFoundResponse,
  badRequestResponse,
  type ApplicationNoteRouteContext,
  noteNotFoundResponse,
  requireApplicationId,
} from "@/lib/server/applicationRouteHelpers";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: ApplicationNoteRouteContext) {
  const { id: rawId, noteId: rawNoteId } = await context.params;
  const noteId = parseUuid(rawNoteId);
  if (!noteId) {
    return noteNotFoundResponse();
  }

  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const note = await getNoteRepository().updateForApplication(applicationId, noteId, parsed.data.content);
  if (!note) {
    return noteNotFoundResponse();
  }

  return NextResponse.json(note);
}

export async function DELETE(_request: Request, context: ApplicationNoteRouteContext) {
  const { id: rawId, noteId: rawNoteId } = await context.params;
  const noteId = parseUuid(rawNoteId);
  if (!noteId) {
    return noteNotFoundResponse();
  }

  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }

  const deleted = await getNoteRepository().deleteForApplication(applicationId, noteId);
  if (!deleted) {
    return noteNotFoundResponse();
  }

  return new NextResponse(null, { status: 204 });
}

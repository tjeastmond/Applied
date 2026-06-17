import { parseUuid } from "@/lib/schemas/common";
import { requireAppAccess } from "@/lib/server/appAuth";
import { getNoteRepository } from "@/lib/server/db";
import { touchApplicationUpdatedAt } from "@/lib/server/touchApplicationUpdatedAt";
import {
  applicationNotFoundResponse,
  badRequestResponse,
  type ApplicationNoteRouteContext,
  noteNotFoundResponse,
  requireApplicationId,
} from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: ApplicationNoteRouteContext) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

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

  const applicationUpdatedAt = await touchApplicationUpdatedAt(applicationId);

  log.info("note updated", {
    route: "/api/applications/[id]/notes/[noteId]",
    method: "PATCH",
    applicationId,
    noteId,
  });

  return NextResponse.json({ ...note, applicationUpdatedAt });
}

export async function DELETE(request: Request, context: ApplicationNoteRouteContext) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

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

  await touchApplicationUpdatedAt(applicationId);

  log.info("note deleted", {
    route: "/api/applications/[id]/notes/[noteId]",
    method: "DELETE",
    applicationId,
    noteId,
  });

  return new NextResponse(null, { status: 204 });
}

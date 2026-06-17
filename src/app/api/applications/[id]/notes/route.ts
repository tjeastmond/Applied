import { getNoteRepository } from "@/lib/server/db";
import { requireAppAccess } from "@/lib/server/appAuth";
import {
  applicationNotFoundResponse,
  badRequestResponse,
  type ApplicationIdRouteContext,
  requireApplicationId,
} from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request, context: ApplicationIdRouteContext) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const { id: rawId } = await context.params;
  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }

  const notes = await getNoteRepository().listByApplicationId(applicationId);
  return NextResponse.json(notes);
}

export async function POST(request: Request, context: ApplicationIdRouteContext) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const { id: rawId } = await context.params;
  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const note = await getNoteRepository().create(applicationId, parsed.data.content);
  log.info("note created", {
    route: "/api/applications/[id]/notes",
    method: "POST",
    applicationId,
    noteId: note.id,
  });
  return NextResponse.json(note, { status: 201 });
}

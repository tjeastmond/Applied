import { withAppAccess } from "@/lib/server/appAuth";
import { getNoteRepository } from "@/lib/server/db";
import { touchApplicationUpdatedAt } from "@/lib/server/touchApplicationUpdatedAt";
import {
  type ApplicationNoteRouteContext,
  noteNotFoundResponse,
  requireApplicationNoteRouteContext,
} from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const PATCH = withAppAccess<ApplicationNoteRouteContext>(async (request: Request, context) => {
  const routeContext = await requireApplicationNoteRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }
  const { applicationId, noteId } = routeContext;

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const note = await getNoteRepository().updateForApplication(applicationId, noteId, data.content);
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
});

export const DELETE = withAppAccess<ApplicationNoteRouteContext>(async (_request: Request, context) => {
  const routeContext = await requireApplicationNoteRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }
  const { applicationId, noteId } = routeContext;

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
});

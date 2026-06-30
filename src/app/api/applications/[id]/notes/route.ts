import { getNoteRepository } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import { touchApplicationUpdatedAt } from "@/lib/server/touchApplicationUpdatedAt";
import { type ApplicationIdRouteContext, requireApplicationRouteContext } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAppAccess<ApplicationIdRouteContext>(async (_request: Request, context) => {
  const routeContext = await requireApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }

  const notes = await getNoteRepository().listByApplicationId(routeContext.id);
  return NextResponse.json(notes);
});

export const POST = withAppAccess<ApplicationIdRouteContext>(async (request: Request, context) => {
  const routeContext = await requireApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }
  const { id: applicationId } = routeContext;

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const note = await getNoteRepository().create(applicationId, data.content);
  const applicationUpdatedAt = await touchApplicationUpdatedAt(applicationId);
  log.info("note created", {
    route: "/api/applications/[id]/notes",
    method: "POST",
    applicationId,
    noteId: note.id,
  });
  return NextResponse.json({ ...note, applicationUpdatedAt }, { status: 201 });
});

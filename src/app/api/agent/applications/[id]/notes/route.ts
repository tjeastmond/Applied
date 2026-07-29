import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { requireAgentApplicationRouteContext } from "@/lib/server/agentRouteHelpers";
import { applicationNotFoundResponse, type ApplicationIdRouteContext } from "@/lib/server/applicationRouteHelpers";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { createNoteForAgent, listNotesForAgent } from "@/lib/server/services/agentApplicationInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request, context: ApplicationIdRouteContext) {
  const authError = await requireAgentAuth(request);
  if (authError) {
    log.warn("agent auth rejected", { route: "/api/agent/applications/[id]/notes", method: "GET" });
    return authError;
  }

  const routeContext = await requireAgentApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }

  const notes = await listNotesForAgent(routeContext.id);
  if (!notes) {
    return applicationNotFoundResponse();
  }

  return NextResponse.json({ notes });
}

export async function POST(request: Request, context: ApplicationIdRouteContext) {
  const authError = await requireAgentAuth(request);
  if (authError) {
    log.warn("agent auth rejected", { route: "/api/agent/applications/[id]/notes", method: "POST" });
    return authError;
  }

  const routeContext = await requireAgentApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const note = await createNoteForAgent(routeContext.id, data.content);
  if (!note) {
    return applicationNotFoundResponse();
  }

  log.info("agent note created", {
    route: "/api/agent/applications/[id]/notes",
    method: "POST",
    applicationId: routeContext.id,
    noteId: note.id,
  });

  return NextResponse.json(note, { status: 201 });
}

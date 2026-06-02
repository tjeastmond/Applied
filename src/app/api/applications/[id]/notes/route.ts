import { getNoteRepository } from "@/lib/server/db";
import {
  applicationNotFoundResponse,
  type ApplicationIdRouteContext,
  requireApplicationId,
} from "@/lib/server/applicationRouteHelpers";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: ApplicationIdRouteContext) {
  const { id: rawId } = await context.params;
  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }

  const notes = await getNoteRepository().listByApplicationId(applicationId);
  return NextResponse.json(notes);
}

export async function POST(request: Request, context: ApplicationIdRouteContext) {
  const { id: rawId } = await context.params;
  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }

  const parsed = await parseRequestBody(request, createApplicationNoteSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const note = await getNoteRepository().create(applicationId, parsed.data.content);
  return NextResponse.json(note, { status: 201 });
}

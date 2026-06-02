import { getNoteRepository, getRepository } from "@/lib/server/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function applicationExists(id: string): Promise<boolean> {
  const application = await getRepository().getById(id);
  return application !== null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await applicationExists(id))) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const notes = await getNoteRepository().listByApplicationId(id);
  return NextResponse.json(notes);
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await applicationExists(id))) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const body = await readJson<{ content?: string }>(request);
  if (!body || typeof body.content !== "string") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const note = await getNoteRepository().create(id, body.content);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create note";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

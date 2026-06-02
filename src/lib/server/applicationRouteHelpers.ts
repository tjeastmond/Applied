import { getRepository } from "@/lib/server/db";
import { parseUuid } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export type ApplicationIdRouteContext = { params: Promise<{ id: string }> };

export type ApplicationNoteRouteContext = { params: Promise<{ id: string; noteId: string }> };

export function parseRouteUuid(raw: string): string | null {
  return parseUuid(raw);
}

export function applicationNotFoundResponse() {
  return NextResponse.json({ error: "Application not found" }, { status: 404 });
}

export async function requireApplicationId(rawId: string): Promise<string | null> {
  const id = parseRouteUuid(rawId);
  if (!id) {
    return null;
  }
  const application = await getRepository().getById(id);
  return application ? id : null;
}

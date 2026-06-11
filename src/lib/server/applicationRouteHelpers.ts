import { log } from "@/lib/server/logging/logger";
import type { LogContext } from "@/lib/server/logging/types";
import { getRepository } from "@/lib/server/db";
import { parseUuid } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export type ApplicationIdRouteContext = { params: Promise<{ id: string }> };

export type ApplicationNoteRouteContext = { params: Promise<{ id: string; noteId: string }> };

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function logAndRespondError(message: string, status: number, context?: LogContext) {
  log.error(message, { ...context, status });
  return jsonError(message, status);
}

export function logAndRespondFromUnknown(error: unknown, message: string, status: number, context?: LogContext) {
  log.errorFromUnknown(error, { ...context, status });
  return jsonError(message, status);
}

export function badRequestResponse(error: string) {
  return jsonError(error, 400);
}

export function applicationNotFoundResponse() {
  return jsonError("Application not found", 404);
}

export function noteNotFoundResponse() {
  return jsonError("Note not found", 404);
}

export async function requireApplicationId(rawId: string): Promise<string | null> {
  const id = parseUuid(rawId);
  if (!id) {
    return null;
  }
  const application = await getRepository().getById(id);
  return application ? id : null;
}

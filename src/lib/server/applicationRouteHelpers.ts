import { log } from "@/lib/server/logging/logger";
import type { LogContext } from "@/lib/server/logging/types";
import { getAgentApiTokenRepository, getRepository } from "@/lib/server/db";
import { parseUuid } from "@/lib/schemas/common";
import type { AgentApiTokenRepository } from "@/lib/server/repositories/agentApiTokenRepository";
import { ApplicationConflictError } from "@/lib/server/services/applicationMutationService";
import { NextResponse } from "next/server";

export type ApplicationIdRouteContext = { params: Promise<{ id: string }> };

export type ApplicationNoteRouteContext = { params: Promise<{ id: string; noteId: string }> };

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function logAndRespondFromUnknown(error: unknown, message: string, status: number, context?: LogContext) {
  log.errorFromUnknown(error, { ...context, status });
  return jsonError(message, status);
}

/** Maps a concurrent-edit conflict to 409 (expected, not logged); rethrows anything else. */
export function conflictResponseOrThrow(error: unknown): Response {
  if (error instanceof ApplicationConflictError) return jsonError(error.message, 409);
  throw error;
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

export async function requireApplicationRouteContext(
  context: ApplicationIdRouteContext,
): Promise<{ id: string } | Response> {
  const { id: rawId } = await context.params;
  const id = await requireApplicationId(rawId);
  if (!id) {
    return applicationNotFoundResponse();
  }
  return { id };
}

export async function requireApplicationNoteRouteContext(
  context: ApplicationNoteRouteContext,
): Promise<{ applicationId: string; noteId: string } | Response> {
  const { id: rawId, noteId: rawNoteId } = await context.params;
  const noteId = parseUuid(rawNoteId);
  if (!noteId) {
    return noteNotFoundResponse();
  }
  const applicationId = await requireApplicationId(rawId);
  if (!applicationId) {
    return applicationNotFoundResponse();
  }
  return { applicationId, noteId };
}

export function requireAgentTokenRepository(): AgentApiTokenRepository | Response {
  const repository = getAgentApiTokenRepository();
  if (!repository) {
    return jsonError("Agent token management is unavailable", 503);
  }
  return repository;
}

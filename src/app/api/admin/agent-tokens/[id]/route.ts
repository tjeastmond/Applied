import { renameAgentApiTokenSchema } from "@/lib/schemas/agentToken";
import { badRequestResponse, jsonError, logAndRespondFromUnknown } from "@/lib/server/applicationRouteHelpers";
import { requireAppAccess } from "@/lib/server/appAuth";
import { getAgentApiTokenRepository } from "@/lib/server/db";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { parseUuid } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AgentTokenRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: AgentTokenRouteContext) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const id = parseUuid((await context.params).id);
  if (!id) {
    return jsonError("Invalid token id", 400);
  }

  const parsed = await parseRequestBody(request, renameAgentApiTokenSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const repository = getAgentApiTokenRepository();
  if (!repository) {
    return jsonError("Agent token management is unavailable", 503);
  }

  try {
    const updated = await Promise.resolve(repository.updateName(id, parsed.data.name));
    if (!updated) {
      return jsonError("Agent token not found", 404);
    }

    log.info("agent token renamed", {
      route: "/api/admin/agent-tokens/[id]",
      method: "PATCH",
      tokenId: id,
      tokenName: updated.name,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return logAndRespondFromUnknown(error, "Failed to rename agent token", 500, {
      route: "/api/admin/agent-tokens/[id]",
      method: "PATCH",
    });
  }
}

export async function DELETE(request: Request, context: AgentTokenRouteContext) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const id = parseUuid((await context.params).id);
  if (!id) {
    return jsonError("Invalid token id", 400);
  }

  const repository = getAgentApiTokenRepository();
  if (!repository) {
    return jsonError("Agent token management is unavailable", 503);
  }

  try {
    const revoked = await Promise.resolve(repository.revoke(id));
    if (!revoked) {
      return jsonError("Agent token not found", 404);
    }

    log.info("agent token revoked", {
      route: "/api/admin/agent-tokens/[id]",
      method: "DELETE",
      tokenId: id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return logAndRespondFromUnknown(error, "Failed to revoke agent token", 500, {
      route: "/api/admin/agent-tokens/[id]",
      method: "DELETE",
    });
  }
}

import { renameAgentApiTokenSchema } from "@/lib/schemas/agentToken";
import { jsonError, logAndRespondFromUnknown, requireAgentTokenRepository } from "@/lib/server/applicationRouteHelpers";
import { withAppAccess } from "@/lib/server/appAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { parseUuid } from "@/lib/schemas/common";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AgentTokenRouteContext = { params: Promise<{ id: string }> };

export const PATCH = withAppAccess<AgentTokenRouteContext>(async (request: Request, context) => {
  const id = parseUuid((await context.params).id);
  if (!id) {
    return jsonError("Invalid token id", 400);
  }

  const parsed = await parseRequestBody(request, renameAgentApiTokenSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const repositoryOrResponse = requireAgentTokenRepository();
  if (repositoryOrResponse instanceof Response) {
    return repositoryOrResponse;
  }
  const repository = repositoryOrResponse;

  try {
    const updated = await Promise.resolve(repository.updateName(id, data.name));
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
});

export const DELETE = withAppAccess<AgentTokenRouteContext>(async (_request: Request, context) => {
  const id = parseUuid((await context.params).id);
  if (!id) {
    return jsonError("Invalid token id", 400);
  }

  const repositoryOrResponse = requireAgentTokenRepository();
  if (repositoryOrResponse instanceof Response) {
    return repositoryOrResponse;
  }
  const repository = repositoryOrResponse;

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
});

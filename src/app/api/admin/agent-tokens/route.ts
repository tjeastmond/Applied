import { createAgentApiTokenSchema } from "@/lib/schemas/agentToken";
import { badRequestResponse, jsonError, logAndRespondFromUnknown } from "@/lib/server/applicationRouteHelpers";
import { requireAppAccess } from "@/lib/server/appAuth";
import { isAgentEnvTokenConfigured } from "@/lib/server/agentEnvToken";
import { agentTokenLimitResponse } from "@/lib/server/agentTokenLimit";
import { getAgentApiTokenRepository } from "@/lib/server/db";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const repository = getAgentApiTokenRepository();
  if (!repository) {
    return jsonError("Agent token management is unavailable", 503);
  }

  try {
    const tokens = await Promise.resolve(repository.listActive());
    const envTokenConfigured = isAgentEnvTokenConfigured();
    const envToken = process.env.AGENT_API_TOKEN?.trim();
    const envTokenRegistered =
      envTokenConfigured && envToken ? await Promise.resolve(repository.hasActiveTokenWithHash(envToken)) : false;

    return NextResponse.json({
      tokens,
      envTokenConfigured,
      envTokenRegistered,
    });
  } catch (error) {
    return logAndRespondFromUnknown(error, "Failed to list agent tokens", 500, {
      route: "/api/admin/agent-tokens",
      method: "GET",
    });
  }
}

export async function POST(request: Request) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const parsed = await parseRequestBody(request, createAgentApiTokenSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const repository = getAgentApiTokenRepository();
  if (!repository) {
    return jsonError("Agent token management is unavailable", 503);
  }

  try {
    const limitError = await agentTokenLimitResponse(repository);
    if (limitError) {
      return limitError;
    }

    const created = await Promise.resolve(repository.create(parsed.data.name));
    log.info("agent token created", {
      route: "/api/admin/agent-tokens",
      method: "POST",
      tokenId: created.record.id,
      tokenName: created.record.name,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return logAndRespondFromUnknown(error, "Failed to create agent token", 500, {
      route: "/api/admin/agent-tokens",
      method: "POST",
    });
  }
}

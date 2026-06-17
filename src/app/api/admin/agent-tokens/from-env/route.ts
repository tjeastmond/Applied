import { importAgentTokenFromEnvSchema } from "@/lib/schemas/agentToken";
import { badRequestResponse, jsonError, logAndRespondFromUnknown } from "@/lib/server/applicationRouteHelpers";
import { requireAppAccess } from "@/lib/server/appAuth";
import { isAgentEnvTokenConfigured } from "@/lib/server/agentEnvToken";
import { agentTokenLimitResponse } from "@/lib/server/agentTokenLimit";
import { getAgentApiTokenRepository } from "@/lib/server/db";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const envToken = process.env.AGENT_API_TOKEN?.trim();
  if (!isAgentEnvTokenConfigured() || !envToken) {
    return jsonError("AGENT_API_TOKEN is not configured", 400);
  }

  const parsed = await parseRequestBody(request, importAgentTokenFromEnvSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const repository = getAgentApiTokenRepository();
  if (!repository) {
    return jsonError("Agent token management is unavailable", 503);
  }

  try {
    const alreadyRegistered = await Promise.resolve(repository.hasActiveTokenWithHash(envToken));
    if (alreadyRegistered) {
      return jsonError("Environment token is already registered", 409);
    }

    const limitError = await agentTokenLimitResponse(repository);
    if (limitError) {
      return limitError;
    }

    const imported = await Promise.resolve(repository.importFromRawToken(parsed.data.name, envToken));
    log.info("agent token imported from env", {
      route: "/api/admin/agent-tokens/from-env",
      method: "POST",
      tokenId: imported.record.id,
      tokenName: imported.record.name,
    });
    return NextResponse.json(imported, { status: 201 });
  } catch (error) {
    return logAndRespondFromUnknown(error, "Failed to import agent token from environment", 500, {
      route: "/api/admin/agent-tokens/from-env",
      method: "POST",
    });
  }
}

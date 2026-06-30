import { createAgentApiTokenSchema } from "@/lib/schemas/agentToken";
import { logAndRespondFromUnknown, requireAgentTokenRepository } from "@/lib/server/applicationRouteHelpers";
import { withAppAccess } from "@/lib/server/appAuth";
import { isAgentEnvTokenConfigured } from "@/lib/server/agentEnvToken";
import { agentTokenLimitResponse } from "@/lib/server/agentTokenLimit";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAppAccess(async () => {
  const repositoryOrResponse = requireAgentTokenRepository();
  if (repositoryOrResponse instanceof Response) {
    return repositoryOrResponse;
  }
  const repository = repositoryOrResponse;

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
});

export const POST = withAppAccess(async (request: Request) => {
  const parsed = await parseRequestBody(request, createAgentApiTokenSchema);
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
    const limitError = await agentTokenLimitResponse(repository);
    if (limitError) {
      return limitError;
    }

    const created = await Promise.resolve(repository.create(data.name));
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
});

import { APPLIED_DEV_CLIENT_HEADER, APPLIED_DEV_CLI_CLIENT_VALUE } from "@/lib/agentClientHeaders";
import { bearerTokenFromRequest, constantTimeEquals } from "@/lib/server/bearerAuth";
import { isAgentEnvTokenConfigured } from "@/lib/server/agentEnvToken";
import { getAgentApiTokenRepository } from "@/lib/server/db";
import { jsonError } from "@/lib/server/applicationRouteHelpers";

export type AgentAuthChannel = "cli" | "api";

export type AgentAuthContext = {
  actorName: string;
  channel: AgentAuthChannel;
};

const ENV_AGENT_TOKEN_ACTOR_NAME = "Environment";

async function isAgentAuthConfigured(): Promise<boolean> {
  if (isAgentEnvTokenConfigured()) {
    return true;
  }

  const repository = getAgentApiTokenRepository();
  if (!repository) {
    return false;
  }

  return Promise.resolve(repository.hasActiveTokens());
}

function resolveAgentAuthChannel(request: Request): AgentAuthChannel {
  const client = request.headers.get(APPLIED_DEV_CLIENT_HEADER)?.trim().toLowerCase();
  return client === APPLIED_DEV_CLI_CLIENT_VALUE ? "cli" : "api";
}

async function resolveAgentActorName(token: string): Promise<string> {
  const repository = getAgentApiTokenRepository();
  if (repository) {
    const name = await Promise.resolve(repository.resolveNameByToken(token));
    if (name) {
      return name;
    }
  }

  const envToken = process.env.AGENT_API_TOKEN?.trim();
  if (envToken && constantTimeEquals(token, envToken)) {
    return ENV_AGENT_TOKEN_ACTOR_NAME;
  }

  return "Unknown";
}

export async function requireAgentAuth(request: Request): Promise<Response | AgentAuthContext> {
  if (!(await isAgentAuthConfigured())) {
    return jsonError("Agent API token is not configured", 503);
  }

  const token = bearerTokenFromRequest(request);
  if (!token) {
    return jsonError("Unauthorized", 401);
  }

  const envToken = process.env.AGENT_API_TOKEN?.trim();
  if (envToken && constantTimeEquals(token, envToken)) {
    return {
      actorName: await resolveAgentActorName(token),
      channel: resolveAgentAuthChannel(request),
    };
  }

  const repository = getAgentApiTokenRepository();
  if (repository && (await Promise.resolve(repository.isValidToken(token)))) {
    void Promise.resolve(repository.touchLastUsed(token)).catch(() => {});
    return {
      actorName: await resolveAgentActorName(token),
      channel: resolveAgentAuthChannel(request),
    };
  }

  return jsonError("Unauthorized", 401);
}

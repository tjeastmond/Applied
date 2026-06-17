import { bearerTokenFromRequest, constantTimeEquals } from "@/lib/server/bearerAuth";
import { isAgentEnvTokenConfigured } from "@/lib/server/agentEnvToken";
import { getAgentApiTokenRepository } from "@/lib/server/db";
import { jsonError } from "@/lib/server/applicationRouteHelpers";

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

export async function requireAgentAuth(request: Request): Promise<Response | null> {
  if (!(await isAgentAuthConfigured())) {
    return jsonError("Agent API token is not configured", 503);
  }

  const token = bearerTokenFromRequest(request);
  if (!token) {
    return jsonError("Unauthorized", 401);
  }

  const envToken = process.env.AGENT_API_TOKEN?.trim();
  if (envToken && constantTimeEquals(token, envToken)) {
    return null;
  }

  const repository = getAgentApiTokenRepository();
  if (repository && (await Promise.resolve(repository.isValidToken(token)))) {
    return null;
  }

  return jsonError("Unauthorized", 401);
}

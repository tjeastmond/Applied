import { MAX_ACTIVE_AGENT_API_TOKENS } from "@/lib/agentTokenLimits";
import { jsonError } from "@/lib/server/applicationRouteHelpers";
import type { AgentApiTokenRepository } from "@/lib/server/repositories/agentApiTokenRepository";

export async function agentTokenLimitResponse(repository: AgentApiTokenRepository): Promise<Response | null> {
  const tokens = await Promise.resolve(repository.listActive());
  if (tokens.length >= MAX_ACTIVE_AGENT_API_TOKENS) {
    return jsonError(
      `Active agent API token limit reached (${MAX_ACTIVE_AGENT_API_TOKENS}). Revoke an agent token to create another. App login is separate and does not count.`,
      409,
    );
  }
  return null;
}

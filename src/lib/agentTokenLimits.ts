/** Active agent API tokens (external AI/agent tools) allowed per deployment. Does not include the app login token. */
export const MAX_ACTIVE_AGENT_API_TOKENS = 2;

/**
 * Future multi-tenant caps (not enforced until users/orgs exist):
 * - 2 active tokens per user
 * - 6 active tokens per organization
 */
export const FUTURE_MAX_AGENT_TOKENS_PER_USER = 2;
export const FUTURE_MAX_AGENT_TOKENS_PER_ORG = 6;

export type AgentTokenSource = "env" | "database" | "both" | "none";

export function resolveAgentTokenSource(envConfigured: boolean, dbHasActiveTokens: boolean): AgentTokenSource {
  if (envConfigured && dbHasActiveTokens) {
    return "both";
  }
  if (envConfigured) {
    return "env";
  }
  if (dbHasActiveTokens) {
    return "database";
  }
  return "none";
}

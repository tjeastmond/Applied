/** Active agent API tokens (external AI/agent tools) allowed per deployment. Does not include the app login token. */
export const MAX_ACTIVE_AGENT_API_TOKENS = 5;

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

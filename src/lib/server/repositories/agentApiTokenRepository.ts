import type { AgentApiTokenSummary, CreateAgentApiTokenResult } from "@/types";

export interface AgentApiTokenRepository {
  listActive(): Promise<AgentApiTokenSummary[]> | AgentApiTokenSummary[];
  create(name: string): Promise<CreateAgentApiTokenResult> | CreateAgentApiTokenResult;
  revoke(id: string): Promise<boolean> | boolean;
  isValidToken(rawToken: string): Promise<boolean> | boolean;
  hasActiveTokens(): Promise<boolean> | boolean;
}

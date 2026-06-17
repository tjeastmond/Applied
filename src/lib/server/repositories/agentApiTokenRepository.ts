import type { AgentApiTokenSummary, CreateAgentApiTokenResult, ImportAgentApiTokenResult } from "@/types";

export interface AgentApiTokenRepository {
  listActive(): Promise<AgentApiTokenSummary[]> | AgentApiTokenSummary[];
  create(name: string): Promise<CreateAgentApiTokenResult> | CreateAgentApiTokenResult;
  importFromRawToken(name: string, rawToken: string): Promise<ImportAgentApiTokenResult> | ImportAgentApiTokenResult;
  revoke(id: string): Promise<boolean> | boolean;
  updateName(id: string, name: string): Promise<AgentApiTokenSummary | null> | AgentApiTokenSummary | null;
  isValidToken(rawToken: string): Promise<boolean> | boolean;
  hasActiveTokens(): Promise<boolean> | boolean;
  hasActiveTokenWithHash(rawToken: string): Promise<boolean> | boolean;
  touchLastUsed(rawToken: string): Promise<void> | void;
}

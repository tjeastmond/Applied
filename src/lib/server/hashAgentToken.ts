import { createHash } from "node:crypto";

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function agentTokenPrefix(token: string): string {
  return token.slice(0, 8);
}

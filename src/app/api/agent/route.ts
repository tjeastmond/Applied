import { resolveAgentTokenSource } from "@/lib/agentTokenLimits";
import { buildAgentDiscoveryPayload } from "@/lib/server/agentDiscovery";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { isAgentEnvTokenConfigured } from "@/lib/server/agentEnvToken";
import { getAgentApiTokenRepository } from "@/lib/server/db";
import { log } from "@/lib/server/logging/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireAgentAuth(request);
  if (authError) {
    log.warn("agent auth rejected", { route: "/api/agent", method: "GET" });
    return authError;
  }

  const repository = getAgentApiTokenRepository();
  const envConfigured = isAgentEnvTokenConfigured();
  const dbHasActiveTokens = repository ? await Promise.resolve(repository.hasActiveTokens()) : false;
  const tokenSource = resolveAgentTokenSource(envConfigured, dbHasActiveTokens);

  return NextResponse.json(buildAgentDiscoveryPayload(tokenSource));
}

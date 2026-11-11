import { resolveAgentTokenSource } from "@/lib/agentTokenLimits";
import { buildAgentDiscoveryPayload } from "@/lib/server/agentDiscovery";
import { withAgentAuth } from "@/lib/server/agentAuth";
import { isAgentEnvTokenConfigured } from "@/lib/server/agentEnvToken";
import { getAgentApiTokenRepository } from "@/lib/server/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAgentAuth("/api/agent", "GET", async () => {
  const repository = getAgentApiTokenRepository();
  const envConfigured = isAgentEnvTokenConfigured();
  const dbHasActiveTokens = repository ? await Promise.resolve(repository.hasActiveTokens()) : false;
  const tokenSource = resolveAgentTokenSource(envConfigured, dbHasActiveTokens);

  return NextResponse.json(buildAgentDiscoveryPayload(tokenSource));
});

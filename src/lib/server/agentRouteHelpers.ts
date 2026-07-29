import { parseUuid } from "@/lib/schemas/common";
import type { AgentApplicationSummary } from "@/lib/schemas/agent";
import { applicationNotFoundResponse, type ApplicationIdRouteContext } from "@/lib/server/applicationRouteHelpers";
import { getApplicationForAgent } from "@/lib/server/services/agentApplicationInterface";

export async function requireAgentApplicationRouteContext(
  context: ApplicationIdRouteContext,
): Promise<{ id: string; application: AgentApplicationSummary } | Response> {
  const { id: rawId } = await context.params;
  const id = parseUuid(rawId);
  if (!id) {
    return applicationNotFoundResponse();
  }

  const application = await getApplicationForAgent(id);
  if (!application) {
    return applicationNotFoundResponse();
  }

  return { id, application };
}
